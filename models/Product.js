const { Schema, model } = require('mongoose');

const ProductSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      defaul: 0,
      required: true,
    },
    rating: {
      type: Number,
      default: 0,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    count: {
      type: Number,
      default: 1,
    },
    images: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    Stock: {
      // кол-во товара на складе
      type: Number,
      required: [true, 'Please Enter Product Stock'],
      maxLength: [4, 'Price cannot exceed 4 characters'],
      default: 1,
    },
    numOfReviews:
      //   кол-во отзывов, комментов
      {
        type: Number,
        default: 0,
      },
    reviews: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        rating: {
          type: Number,
          required: true,
        },
        comment: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = model('Product', ProductSchema);
