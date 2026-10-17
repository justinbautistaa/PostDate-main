import api from "../api";

export const getConversations = async (before) => (await api.get("/chats", { params: { before } })).data;
export const getConversation = async id => (await api.get(`/chats/${encodeURIComponent(id)}/summary`)).data;
export const getMessages = async (id, before) => (await api.get(`/chats/${encodeURIComponent(id)}/messages`, { params: { before } })).data;
export const getMatchedProfile = async id => (await api.get(`/chats/${encodeURIComponent(id)}/profile`)).data;
export const sendMessage = async (id, text) => (await api.post(`/chats/${encodeURIComponent(id)}/messages`, { text })).data;
