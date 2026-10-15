const request = require('./http');
const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
jest.mock('../utils/verification', () => ({ ...jest.requireActual('../utils/verification'), emailCode: jest.fn().mockResolvedValue() }));
process.env.JWT_SECRET = 'test-only-secret-long-enough-for-signing';
const { emailCode } = require('../utils/verification');
const app = require('../server').createApp();
const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const Swipe = require('../models/Swipe');
const Rating = require('../models/Rating');
const { UPLOAD_DIR } = require('../utils/photoStorage');
const signup = { privacyConsent:'true', firstName:'Alice', lastName:'Example', email:'alice@example.com', password:'Password123!', birthdate:'1997-01-15', gender:'female', tags:['Hiking'] };
const files = new Set();
let mongo;
const codeFor = email => emailCode.mock.calls.findLast(args => args[0] === email)[1];
async function account(overrides = {}) {
 const body = {...signup,...overrides};
 const created = await request(app).post('/api/signup').send(body).expect(201);
 await request(app).post('/api/verify/send').send({email:body.email}).expect(200);
 await request(app).post('/api/verify/confirm').send({email:body.email,code:codeFor(body.email)}).expect(200);
 const login = await request(app).post('/api/auth/login').send({email:body.email,password:body.password}).expect(200);
 return {id:created.body.userId,email:body.email,cookie:login.headers['set-cookie'][0].split(';')[0]};
}
const auth = user => ({Cookie:user.cookie});
const image = () => sharp({create:{width:5,height:5,channels:3,background:'blue'}}).png().toBuffer();
async function upload(user,count=1) {
 let call = request(app).post('/api/profile/photos').set(auth(user));
 const bytes = await image();
 for(let i=0;i<count;i++) call=call.attach('photos',bytes,`${i}.png`);
 const result=await call;
 for(const photo of result.body.photos || []) files.add(photo);
 return result;
}
beforeAll(async()=>{mongo=await MongoMemoryServer.create();await mongoose.connect(mongo.getUri());await Promise.all(Object.values(mongoose.models).map(m=>m.init()));});
afterEach(async()=>{jest.restoreAllMocks();await Promise.all(Object.values(mongoose.models).map(m=>m.deleteMany({})));emailCode.mockClear();await Promise.all([...files].map(photo=>fs.unlink(path.join(UPLOAD_DIR,path.basename(photo))).catch(()=>{})));files.clear();});
afterAll(async()=>{await mongoose.disconnect();await mongo.stop();});

test('verification rejects incorrect codes, expires challenges, consumes success and limits guesses',async()=>{
 await request(app).post('/api/signup').send(signup).expect(201);
 const confirm=code=>request(app).post('/api/verify/confirm').send({email:signup.email,code});
 expect((await confirm('000000')).body.verified).toBe(false);
 await request(app).post('/api/verify/send').send({email:signup.email}).expect(200);
 let code=codeFor(signup.email);
 const wrong=code==='000000'?'111111':'000000';
 for(let i=0;i<5;i++) expect((await confirm(wrong)).body.verified).toBe(false);
 expect((await confirm(code)).body.verified).toBe(false);
 await User.updateMany({},{$set:{verificationSentAt:new Date(0)}});
 await request(app).post('/api/verify/send').send({email:signup.email}).expect(200);
 code=codeFor(signup.email);
 await User.updateMany({},{$set:{verificationExpiresAt:new Date(0)}});
 expect((await confirm(code)).body.verified).toBe(false);
 await User.updateMany({},{$set:{verificationSentAt:new Date(0)}});
 await request(app).post('/api/verify/send').send({email:signup.email}).expect(200);
 code=codeFor(signup.email);
 expect((await confirm(code)).body.verified).toBe(true);
 expect((await confirm(code)).body.verified).toBe(false);
});
test('recovery changes password, invalidates sessions and cannot be replayed',async()=>{
 const user=await account();
 const known=await request(app).post('/api/auth/recovery/request').send({email:user.email});
 const unknown=await request(app).post('/api/auth/recovery/request').send({email:'missing@example.com'});
 expect(known.body).toEqual(unknown.body);
 const proof=await request(app).post('/api/auth/recovery/verify').send({email:user.email,code:codeFor(user.email)}).expect(200);
 const payload={resetToken:proof.body.resetToken,newPassword:'ChangedPassword123!'};
 await request(app).post('/api/auth/recovery/reset').send(payload).expect(200);
 await request(app).post('/api/auth/recovery/reset').send(payload).expect(400);
 await request(app).get('/api/auth/session').set(auth(user)).expect(401);
 await request(app).post('/api/auth/login').send({email:user.email,password:signup.password}).expect(401);
 await request(app).post('/api/auth/login').send({email:user.email,password:payload.newPassword}).expect(200);
});
test('discovery filters profiles and mutual likes create exactly one match',async()=>{
 const alice=await account(),bob=await account({email:'bob@example.com',firstName:'Bob',gender:'male'});
 const result=await request(app).get('/api/discover').query({query:'bob',gender:'Man'}).set(auth(alice)).expect(200);
 expect(result.body.profiles.map(p=>p.id)).toEqual([bob.id]);
 await request(app).post('/api/discover/like').set(auth(alice)).send({profileId:bob.id}).expect(200);
 expect((await request(app).post('/api/discover/like').set(auth(bob)).send({profileId:alice.id})).body.matched).toBe(true);
 await request(app).post('/api/discover/like').set(auth(bob)).send({profileId:alice.id}).expect(200);
 expect(await Match.countDocuments()).toBe(1);
 expect((await request(app).get('/api/discover').set(auth(alice))).body.profiles).toEqual([]);
});
test('profile updates and sanitized photos persist without exposing account secrets',async()=>{
 const user=await account();
 await request(app).put('/api/profile/tags').set(auth(user)).send({tags:['Hiking']}).expect(200);
 await request(app).put('/api/profile/tags').set(auth(user)).send({tags:[{}]}).expect(400);
 await request(app).post('/api/profile/photos').set(auth(user)).attach('photos',Buffer.from('invalid'),'fake.jpg').expect(400);
 const uploaded=await upload(user);expect(uploaded.status).toBe(201);
 await request(app).get(uploaded.body.photos[0]).expect(401);
 await request(app).get(uploaded.body.photos[0]).set(auth(user)).expect(200).expect('Content-Type',/webp/);
 const profile=await request(app).get('/api/profile/me').set(auth(user)).expect(200);
 expect(profile.body.profile.interests).toEqual(['Hiking']);
 expect(JSON.stringify(profile.body)).not.toMatch(/passwordHash|sessionVersion|verificationHash|alice@example.com/);
});
test('signup rejects malformed fields without partial users and accepts a sanitized photo',async()=>{
 await request(app).post('/api/signup').send({...signup,middleName:{}}).expect(400);
 await request(app).post('/api/signup').send({...signup,password:'x'.repeat(73)}).expect(400);
 expect(await User.countDocuments()).toBe(0);
 let signupRequest=request(app).post('/api/signup'); for(const [key,value] of Object.entries(signup)) signupRequest=signupRequest.field(key,Array.isArray(value)?JSON.stringify(value):value); const created=await signupRequest.attach('photos',await image(),'photo.png').expect(201);
 const profile=await Profile.findOne({userId:created.body.userId});profile.photos.forEach(p=>files.add(p));expect(profile.photos).toHaveLength(1);
});
test('avatars can be changed and non-avatar photos deleted without breaking the gallery',async()=>{
 const user=await account(),uploaded=await upload(user,2);expect(uploaded.status).toBe(201);
 const [first,second]=uploaded.body.photos;
 await request(app).delete(`/api/profile/photos/${path.basename(first)}`).set(auth(user)).expect(400);
 await request(app).put('/api/profile/avatar').set(auth(user)).send({photo:second}).expect(200);
 const deleted=await request(app).delete(`/api/profile/photos/${path.basename(first)}`).set(auth(user)).expect(200);
 expect(deleted.body.photos).toEqual([second]);await request(app).get(first).set(auth(user)).expect(404);await request(app).get(second).set(auth(user)).expect(200);
});
test('live role changes control access and deactivation revokes sessions',async()=>{
 const user=await account();await request(app).get('/api/admin/users').set(auth(user)).expect(403);
 await User.updateOne({_id:user.id},{role:'moderator'});await request(app).get('/api/admin/users').set(auth(user)).expect(200);
 await request(app).get('/api/admin/activity').set(auth(user)).expect(403);
 await User.updateOne({_id:user.id},{role:'admin'});
 for(const section of ['overview','statistics','users','reports','ratings','appeals','activity']) await request(app).get(`/api/admin/${section}`).set(auth(user)).expect(200);
 await User.updateOne({_id:user.id},{isActive:false});await request(app).get('/api/auth/session').set(auth(user)).expect(401);
});
test('uppercase IDs cannot self-swipe or duplicate a match',async()=>{
 const alice=await account(),bob=await account({email:'bob@example.com'});
 for(const action of ['like','pass']) await request(app).post(`/api/discover/${action}`).set(auth(alice)).send({profileId:alice.id.toUpperCase()}).expect(400);
 expect(await Swipe.countDocuments()).toBe(0);
 await request(app).post('/api/discover/like').set(auth(alice)).send({profileId:bob.id.toUpperCase()}).expect(200);
 await request(app).post('/api/discover/like').set(auth(bob)).send({profileId:alice.id.toUpperCase()}).expect(200);
 await request(app).post('/api/discover/like').set(auth(alice)).send({profileId:bob.id}).expect(200);
 expect(await Match.countDocuments()).toBe(1);
});
test('failed photo writes retain the existing gallery',async()=>{
 const user=await account(),first=await upload(user);
 jest.spyOn(console,'error').mockImplementation(()=>{});jest.spyOn(Profile,'findOneAndUpdate').mockRejectedValueOnce(new Error('Write failed'));
 const failed=await upload(user);expect(failed.status).toBe(500);
 expect((await Profile.findOne({userId:user.id})).photos).toEqual(first.body.photos);
});
test('lost write acknowledgements do not delete committed photos',async()=>{
 const user=await account(),original=Profile.findOneAndUpdate.bind(Profile);
 jest.spyOn(console,'error').mockImplementation(()=>{});
 jest.spyOn(Profile,'findOneAndUpdate').mockImplementationOnce(async(...args)=>{await original(...args);throw new Error('Lost acknowledgement');});
 const failed=await upload(user);expect(failed.status).toBe(500);
 const profile=await Profile.findOne({userId:user.id});expect(profile.photos).toHaveLength(1);profile.photos.forEach(p=>files.add(p));
 await request(app).get(profile.photos[0]).set(auth(user)).expect(200);
});
test('discovery paginates without duplicates and treats search text literally',async()=>{
 const viewer=await account();
 const users=await User.insertMany(Array.from({length:26},(_,i)=>({firstName:`Member ${i}`,lastName:'Example',email:`m${i}@example.com`,passwordHash:'unused',isVerified:true,emailVerifiedAt:new Date()})));
 await Profile.insertMany(users.map(u=>({userId:u._id,gender:'male',dateOfBirth:new Date('1997-01-01')})));
 const found=[];let cursor;
 do{const result=await request(app).get('/api/discover').query({query:'Member',...(cursor?{cursor}:{})}).set(auth(viewer)).expect(200);found.push(...result.body.profiles.map(p=>p.id));cursor=result.body.nextCursor;}while(cursor);
 expect(found).toHaveLength(26);expect(new Set(found).size).toBe(26);
 expect((await request(app).get('/api/discover').query({query:'.*'}).set(auth(viewer))).body.profiles).toEqual([]);
 await request(app).get('/api/discover?cursor=invalid').set(auth(viewer)).expect(400);
});
test('discovery checks exact adult birthday boundaries and inactive accounts',async()=>{
 const viewer=await account(),today=new Date();const birth=new Date(Date.UTC(today.getUTCFullYear()-18,today.getUTCMonth(),today.getUTCDate()));const tomorrow=new Date(birth);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 const users=await User.insertMany(['adult','young','inactive'].map((name,i)=>({firstName:name,lastName:'Test',email:`${name}@example.com`,passwordHash:'unused',isVerified:true,emailVerifiedAt:new Date(),isActive:i!==2})));
 await Profile.insertMany(users.map((u,i)=>({userId:u._id,gender:'female',dateOfBirth:i===1?tomorrow:birth})));
 const result=await request(app).get('/api/discover?minAge=18&maxAge=18').set(auth(viewer)).expect(200);expect(result.body.profiles.map(p=>p.id)).toEqual([String(users[0]._id)]);
});
test('database execution limits return a retryable response',async()=>{
 const viewer=await account(),option=jest.fn().mockRejectedValue(Object.assign(new Error('Timed out'),{code:50}));jest.spyOn(Profile,'aggregate').mockReturnValueOnce({option});
 await request(app).get('/api/discover').set(auth(viewer)).expect(503);expect(option).toHaveBeenCalledWith({maxTimeMS:5000,allowDiskUse:false});
});
