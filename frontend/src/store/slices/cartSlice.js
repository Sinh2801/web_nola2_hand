import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api.js'
import { logout } from './authSlice.js'

const errMsg = (error, fallback) => error.response?.data?.message || fallback

export const fetchCart = createAsyncThunk('cart/fetchCart', async (_, { rejectWithValue }) => {
    try {
        const res = await api.get('/cart')
        return res.data
    } catch (error) {
        return rejectWithValue(errMsg(error, 'Không thể tải giỏ hàng'))
    }
})

export const addToCart = createAsyncThunk('cart/addToCart', async (productId, { rejectWithValue }) => {
    try {
        const res = await api.post('/cart/items', { productId })
        return res.data
    } catch (error) {
        return rejectWithValue(errMsg(error, 'Không thể thêm vào giỏ hàng'))
    }
})

export const removeFromCart = createAsyncThunk('cart/removeFromCart', async (productId, { rejectWithValue }) => {
    try {
        const res = await api.delete(`/cart/items/${productId}`)
        return res.data
    } catch (error) {
        return rejectWithValue(errMsg(error, 'Không thể xóa khỏi giỏ hàng'))
    }
})

// payload: { productIds: [...] } hoặc { unavailable: true }
export const removeManyFromCart = createAsyncThunk('cart/removeMany', async (payload, { rejectWithValue }) => {
    try {
        const res = await api.post('/cart/remove', payload)
        return res.data
    } catch (error) {
        return rejectWithValue(errMsg(error, 'Không thể cập nhật giỏ hàng'))
    }
})

const applyCart = (state, action) => {
    const data = action.payload?.data
    if (data) {
        state.items = data.items || []
        state.count = data.count || 0
        state.availableCount = data.availableCount || 0
    }
    state.loaded = true
    state.loading = false
    state.error = null
}

const initialState = {
    items: [],
    count: 0,
    availableCount: 0,
    loading: false,
    loaded: false,
    error: null
}

const cartSlice = createSlice({
    name: 'cart',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchCart.pending, (state) => {
                state.loading = true
            })
            .addCase(fetchCart.fulfilled, applyCart)
            .addCase(fetchCart.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload || 'Không thể tải giỏ hàng'
            })
            .addCase(addToCart.fulfilled, applyCart)
            .addCase(removeFromCart.fulfilled, applyCart)
            .addCase(removeManyFromCart.fulfilled, applyCart)
            // Đăng xuất thì xóa dữ liệu giỏ trên client
            .addCase(logout.fulfilled, () => initialState)
    }
})

export default cartSlice.reducer