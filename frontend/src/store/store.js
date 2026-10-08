import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice.js'
import productReducer from './slices/productSlice.js'
import userReducer from './slices/userSlice.js'
import postReducer from './slices/postSlice.js'
import storyReducer from './slices/storySlice.js'
import followReducer from './slices/followSlice.js'
import collectionReducer from './slices/collectionSlice.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    product: productReducer,
    user: userReducer,
    post: postReducer,
    story: storyReducer,
    follow: followReducer,
    collection: collectionReducer
  }
})








