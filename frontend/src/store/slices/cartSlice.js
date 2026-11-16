import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

// Lấy giỏ hàng của người dùng đang đăng nhập
export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/cart')
      return res.data.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Không thể tải giỏ hàng'
      )
    }
  }
)

// Thêm sản phẩm vào giỏ (truyền vào productId)
export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async (productId, { rejectWithValue }) => {
    try {
      const res = await api.post('/cart', { productId })
      return res.data.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Không thể thêm vào giỏ hàng'
      )
    }
  }
)

// Xóa 1 sản phẩm khỏi giỏ
export const removeFromCart = createAsyncThunk(
  'cart/removeFromCart',
  async (productId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/cart/${productId}`)
      return res.data.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Không thể xóa khỏi giỏ hàng'
      )
    }
  }
)

// Xóa toàn bộ giỏ
export const clearCart = createAsyncThunk(
  'cart/clearCart',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.delete('/cart')
      return res.data.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Không thể làm trống giỏ hàng'
      )
    }
  }
)

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [], // [{ product: {...}, addedAt }]
    loading: false,
    error: null
  },
  reducers: {
    // Dùng khi đăng xuất: xóa giỏ trong Redux (không gọi API)
    resetCart: (state) => {
      state.items = []
      state.loading = false
      state.error = null
    }
  },
  extraReducers: (builder) => {
    const setItems = (state, action) => {
      state.items = action.payload
      state.loading = false
      state.error = null
    }
    const setError = (state, action) => {
      state.loading = false
      state.error = action.payload || action.error?.message
    }

    builder
      .addCase(fetchCart.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCart.fulfilled, setItems)
      .addCase(fetchCart.rejected, setError)

      .addCase(addToCart.fulfilled, setItems)
      .addCase(addToCart.rejected, setError)

      .addCase(removeFromCart.fulfilled, setItems)
      .addCase(removeFromCart.rejected, setError)

      .addCase(clearCart.fulfilled, setItems)
      .addCase(clearCart.rejected, setError)
  }
})

export const { resetCart } = cartSlice.actions
export default cartSlice.reducer
