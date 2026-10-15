const request = require("supertest"), mongoose = require("mongoose"), bcrypt = require("bcryptjs"), jwt = require("jsonwebtoken"), OTPAuth = require("otpauth");
const { MongoMemoryServer } = require("mongodb-memory-server");
process.env.JWT_SECRET = "mfa-test-secret-long-enough-for-hmac-and-jwt";
process.env.MFA_ENCRYPTION_KEY = "a".repeat(64);
const { createApp } = require("../server");
const User = require("../models/User"), Profile = require("../models/Profile"), Challenge = require("../models/MfaChallenge");
const mfa = require("../utils/mfa");
let mongo, app, alice, bob;
const password = "PrivatePassword123";
const token = user => `postdate=${jwt.sign({userId:user.id, version:0},process.env.JWT_SECRET,{issuer:"postdate",audience:"postdate-web"})}`;
const call = (method, path, cookie) => { const req = request(app)[method](`/api${path}`).set("X-Postdate-Request","1"); return cookie ? req.set("Cookie",cookie) : req; };
const login = user => call("post","/auth/login").send({email:user.email,password});
beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); app=createApp(); });
beforeEach(async () => {
  await Promise.all([User.deleteMany({}),Profile.deleteMany({}),Challenge.deleteMany({}),require("../models/DeletionJob").deleteMany({}),require("../models/Match").deleteMany({})]);
  [alice,bob]=await User.create(["Alice","Bob"].map(firstName=>({firstName,lastName:"Test",email:`${firstName}@example.test`,passwordHash:bcrypt.hashSync(password,4),isVerified:true,emailVerifiedAt:new Date()})));
  await Profile.create({userId:bob.id,dateOfBirth:new Date("1995-01-01"),gender:"male",interests:["Hiking"]});
});
test("profile photo access requires a session and respects hidden and ended matches",async()=>{
  const fs=require("fs/promises"),path=require("path"),{UPLOAD_DIR,ensureUploadDir}=require("../utils/photoStorage");
  const name=require("crypto").randomBytes(16).toString("hex")+".webp",url=`/uploads/${name}`;
  await ensureUploadDir();await fs.writeFile(path.join(UPLOAD_DIR,name),Buffer.from("test-image"),{flag:"wx"});
  await Profile.updateOne({userId:bob.id},{$set:{photos:[url]}});
  const get=cookie=>{const req=request(app).get(url);return cookie?req.set("Cookie",cookie):req;};
  try {
    await get().expect(401);
    expect((await get(token(bob)).expect(200)).headers["cache-control"]).toContain("no-store");
    await get(token(alice)).expect(200);
    await Profile.updateOne({userId:bob.id},{$set:{discoverable:false}});
    await get(token(alice)).expect(404);
    const match=await require("../models/Match").create({user1:alice.id,user2:bob.id,status:"active"});
    await get(token(alice)).expect(200);
    await require("../models/Match").updateOne({_id:match.id},{$set:{status:"blocked"}});
    await get(token(alice)).expect(404);
  } finally {await fs.unlink(path.join(UPLOAD_DIR,name));}
});
test("account deletion requires confirmation and password, revokes access and cleans up durably",async()=>{
  const Job=require("../models/DeletionJob"),Report=require("../models/Report");
  await call("post","/privacy/delete-account",token(bob)).send({password,confirmation:"no"}).expect(400);
  await call("post","/privacy/delete-account",token(bob)).send({password:"wrong",confirmation:"DELETE"}).expect(403);
  expect(await User.exists({_id:bob.id})).toBeTruthy();
  await Report.create({reporterId:alice.id,targetType:"user",targetId:bob.id,reportedUserId:bob.id,reason:"Other",description:"Moderation evidence"});
  await call("post","/privacy/delete-account",token(bob)).send({password,confirmation:"DELETE",userId:alice.id}).expect(202);
  expect(await Job.exists({userId:bob.id})).toBeTruthy();
  await call("get","/auth/session",token(bob)).expect(401);
  await require("../utils/accountDeletion").cleanOne();
  expect(await User.exists({_id:bob.id})).toBeNull();
  expect(await Profile.exists({userId:bob.id})).toBeNull();
  expect(await User.exists({_id:alice.id})).toBeTruthy();
  expect(await Job.exists({userId:bob.id})).toBeNull();
  expect(await Report.exists({reportedUserId:bob.id})).toBeTruthy();
});
test("account cleanup retries storage failures without reopening the account",async()=>{
  const Job=require("../models/DeletionJob"),storage=require("../utils/photoStorage");
  await Profile.updateOne({userId:bob.id},{$set:{photos:[`/uploads/${"c".repeat(32)}.webp`]}});
  await require("../utils/accountDeletion").requestDeletion(bob);
  const deletion=jest.spyOn(storage,"deletePhotoFile").mockRejectedValueOnce(new Error("provider unavailable")).mockResolvedValue(undefined);
  const log=jest.spyOn(console,"error").mockImplementation(()=>{});
  try {
    await require("../utils/accountDeletion").cleanOne();
    expect(await Job.exists({userId:bob.id})).toBeTruthy();
    await call("get","/auth/session",token(bob)).expect(401);
    await Job.updateOne({userId:bob.id},{$set:{leaseUntil:new Date(0)}});
    await require("../utils/accountDeletion").cleanOne();
    expect(await User.exists({_id:bob.id})).toBeNull();
    expect(await Job.exists({userId:bob.id})).toBeNull();
  } finally {deletion.mockRestore();log.mockRestore();}
});
test("MFA-protected deletion needs a fresh factor and staff accounts cannot self-delete",async()=>{
  alice.role="admin";await alice.save();
  await call("post","/privacy/delete-account",token(alice)).send({password,confirmation:"DELETE"}).expect(403);
  const secret=new OTPAuth.Secret({size:20}).base32;
  await User.updateOne({_id:bob.id},{$set:{mfaEnabled:true,mfaSecret:mfa.encrypt(secret),mfaLastCounter:-1}});
  const cookie=`postdate=${jwt.sign({userId:bob.id,version:0,mfaVerified:true},process.env.JWT_SECRET,{issuer:"postdate",audience:"postdate-web"})}`;
  await call("post","/privacy/delete-account",cookie).send({password,confirmation:"DELETE"}).expect(403);
  const code=new OTPAuth.TOTP({secret}).generate();
  await call("post","/privacy/delete-account",cookie).send({password,confirmation:"DELETE",code}).expect(202);
});
test("cloud photos are proxied without redirecting or exposing signed provider URLs",async()=>{
  const saved={};for(const key of ["STORAGE_PROVIDER","CLOUDINARY_CLOUD_NAME","CLOUDINARY_API_KEY","CLOUDINARY_API_SECRET"]) saved[key]=process.env[key];
  const original=global.fetch;
  process.env.STORAGE_PROVIDER="cloudinary";process.env.CLOUDINARY_CLOUD_NAME="test-cloud";process.env.CLOUDINARY_API_KEY="test-key";process.env.CLOUDINARY_API_SECRET="test-secret";
  const photo=`/uploads/${"d".repeat(32)}.webp`;await Profile.updateOne({userId:bob.id},{$set:{photos:[photo]}});
  global.fetch=jest.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>Buffer.from("private-photo-bytes")});
  try {
    const result=await request(app).get(photo).set("Cookie",token(bob)).expect(200);
    expect(result.headers.location).toBeUndefined();expect(result.body.toString()).toBe("private-photo-bytes");
    expect(global.fetch.mock.calls[0][0]).toContain("type=authenticated");
    expect(result.headers["cache-control"]).toContain("no-store");
  } finally {global.fetch=original;for(const [key,value] of Object.entries(saved)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
afterAll(async()=>{await mongoose.disconnect();await mongo.stop();});
test("authenticator enrollment, replay prevention, single-use recovery, and stale-session revocation",async()=>{
  const enrolled=(await call("post","/auth/mfa/enroll",token(alice)).send({password}).expect(200)).body;
  const authenticator=new OTPAuth.TOTP({secret:enrolled.secret});
  const enabled=await call("post","/auth/mfa/verify").send({challenge:enrolled.challenge,code:authenticator.generate()}).expect(200);
  expect(enabled.body.recoveryCodes).toHaveLength(8);
  const user=await User.findById(alice.id).select("+mfaSecret +mfaRecoveryHashes");
  expect(user.mfaSecret).not.toContain(enrolled.secret);
  expect(user.mfaRecoveryHashes).not.toContain(enabled.body.recoveryCodes[0]);
  await call("get","/auth/session",token(alice)).expect(401);
  const pending=await login(alice).expect(200);
  expect(pending.headers["set-cookie"]).toBeUndefined();
  expect(pending.body).toMatchObject({mfaRequired:true,mfaSetupRequired:false});
  await call("post","/auth/mfa/verify").send({challenge:pending.body.challenge,code:authenticator.generate()}).expect(401);
  const verified=await call("post","/auth/mfa/verify").send({challenge:pending.body.challenge,code:enabled.body.recoveryCodes[0]}).expect(200);
  await call("get","/auth/session",verified.headers["set-cookie"][0].split(";")[0]).expect(200);
  await call("post","/auth/mfa/verify").send({challenge:pending.body.challenge,code:enabled.body.recoveryCodes[1]}).expect(401);
  const second=(await login(alice)).body;
  await call("post","/auth/mfa/verify").send({challenge:second.challenge,code:enabled.body.recoveryCodes[0]}).expect(401);
  const next=authenticator.generate({timestamp:Date.now()+30000});
  await call("post","/auth/mfa/verify").send({challenge:second.challenge,code:next}).expect(200);
});
test("MFA challenges expire and stop accepting guesses after five attempts",async()=>{
  const enrolled=(await call("post","/auth/mfa/enroll",token(alice)).send({password})).body;
  const valid=new OTPAuth.TOTP({secret:enrolled.secret}).generate();
  const wrong=valid==="000000"?"111111":"000000";
  for(let i=0;i<5;i++) await call("post","/auth/mfa/verify").send({challenge:enrolled.challenge,code:wrong}).expect(401);
  await call("post","/auth/mfa/verify").send({challenge:enrolled.challenge,code:valid}).expect(401);
  const next=(await call("post","/auth/mfa/enroll",token(alice)).send({password})).body;
  await Challenge.updateOne({tokenHash:mfa.hash(next.challenge)},{$set:{expiresAt:new Date(0)}});
  await call("post","/auth/mfa/verify").send({challenge:next.challenge,code:valid}).expect(401);
});
test("production administrators cannot sign in with password alone",async()=>{
  alice.role="admin";await alice.save();
  const original=process.env.NODE_ENV;process.env.NODE_ENV="production";
  try { const result=await login(alice).expect(200);expect(result.body.mfaSetupRequired).toBe(true);expect(result.headers["set-cookie"]).toBeUndefined(); }
  finally {process.env.NODE_ENV=original;}
});
test("promoting an existing session to staff cannot bypass production MFA",async()=>{
  const signedIn=await login(alice).expect(200);
  const cookie=signedIn.headers["set-cookie"][0].split(";")[0].replace(/^postdate=/,"__Host-postdate=");
  await User.updateOne({_id:alice.id},{$set:{role:"moderator"}});
  const original=process.env.NODE_ENV;process.env.NODE_ENV="production";
  try { const result=await call("get","/auth/session",cookie).expect(401);expect(result.body.message).toBe("Multi-factor login required"); }
  finally {process.env.NODE_ENV=original;}
});
test("errors after a stream response starts are delegated without writing another response",()=>{
  const {errorHandler}=require("../middleware/errorHandler");
  const next=jest.fn(),res={headersSent:true,status:jest.fn()};
  const error={code:50};errorHandler(error,{},res,next);
  expect(next).toHaveBeenCalledWith(error);expect(res.status).not.toHaveBeenCalled();
});
test("privacy controls reject invalid changes, hide discovery and export only own allowlisted data",async()=>{
  await Profile.collection.updateOne({userId:bob._id},{$set:{internalReview:"Private internal field"}});
  await call("put","/privacy/settings",token(bob)).send({discoverable:"false"}).expect(400);
  await call("put","/privacy/settings",token(bob)).send({discoverable:false}).expect(200);
  expect((await call("get","/discover",token(alice))).body.profiles).toEqual([]);
  await call("post","/discover/like",token(alice)).send({profileId:bob.id}).expect(404);
  const exported=(await call("get","/privacy/export",token(alice)).expect(200)).body;
  expect(exported.account.email).toBe(alice.email);
  expect(JSON.stringify(exported)).not.toMatch(/passwordHash|mfaSecret|mfaRecovery|Bob@example/);
  const ownExport=(await call("get","/privacy/export",token(bob)).expect(200)).body;
  expect(ownExport.profile.interests).toEqual(["Hiking"]);
  expect(JSON.stringify(ownExport)).not.toContain("Private internal field");
});
test("malformed JSON and operator inputs return safe validation errors",async()=>{
  const malformed=await call("post","/auth/login").set("Content-Type","application/json").send('{"password":"private-do-not-echo",').expect(400);
  expect(JSON.stringify(malformed.body)).not.toMatch(/private-do-not-echo|SyntaxError|stack/);
  await call("post","/auth/login").send({email:{$ne:null},password:"test"}).expect(400);
  await call("put","/privacy/settings",token(bob)).send({discoverable:true,role:"admin"}).expect(400);
});
test("enrollment is restricted to the account owner and requires the current password",async()=>{
  await call("post","/auth/mfa/enroll").send({password}).expect(401);
  await call("post","/auth/mfa/enroll",token(alice)).send({password:"wrong-password"}).expect(401);
  await call("post","/auth/mfa/enroll",token(alice)).send({password,userId:bob.id}).expect(200);
  const challenge=await Challenge.findOne({userId:alice.id});
  expect(challenge).toBeTruthy();
  expect(await Challenge.exists({userId:bob.id})).toBeNull();
});
test("signup records a versioned privacy acknowledgement and rejects missing consent",async()=>{
  const input={firstName:"New",lastName:"Member",email:"new@example.test",password,birthdate:"1998-01-01",gender:"female"};
  await call("post","/signup").send(input).expect(400);
  await call("post","/signup").send({...input,privacyConsent:true}).expect(201);
  const user=await User.findOne({email:input.email});expect(user.privacyConsentAt).toBeInstanceOf(Date);expect(user.privacyPolicyVersion).toBe("2026-10-16");
});
