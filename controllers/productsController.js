const Product = require('../models/Product');
const User = require('../models/User');
const fs = require('fs');
const fsPromises = fs.promises;
const { v4: uuid } = require('uuid');
const path = require('path');
const cloudinary = require('cloudinary');
const ApiFeatures = require('../utils/apiFeatures');

// @desc Get all products count
// @route GET /products/count
// @access Public
const getCount = async (req, res) => {
  let count = 0;
  const categoryId = req.query?.categoryId;

  const search = req.query?.query;
  const input = search ? { title: new RegExp(search, 'i') } : {};

  if (categoryId) {
    count = await Product.find({
      $and: [
        { category: categoryId },
        // , input
      ],
    })
      .countDocuments()
      .lean();
  } else {
    count = await Product.find(input).countDocuments().lean();
  }

  // const count = await Product.countDocuments().lean();
  // if (!count) {
  //   return res.status(400).json({ message: 'No productsCount ' });
  // }
  res.json(count);
};

// @desc Get all products
// @route GET /products
// @access Public
const getAllProducts = async (req, res) => {
  const startProduct = req.query?.startProduct ?? undefined;
  const limit = req.query?.limit ?? undefined;
  let sort = req.query?.sort;
  sort = sort ? `{"${sort}": 1 }` : '{"rating":1}';

  const search = req.query?.search;
  const input = search ? { title: new RegExp(search, 'i') } : {};
  // console.log(req.query);
  // Get all products from MongoDB
  const products = await Product.find(input)
    .sort(JSON.parse(sort))
    .skip(startProduct)
    .limit(limit)
    .populate('category')
    // .populate('reviews.user')
    .lean();

  // If no products
  if (!products?.length) {
    return res.status(400).json({ message: 'No products found' });
  }

  // res.json({ products, count });
  res.json(products);
};

//get all products. get('/all/products').Public
const getProducts = async (req, res, next) => {
  // return next(new ErrorHandler('My Error', 500));

  const resultPerPage = 4;
  const productsCount = await Product.countDocuments();

  const apiFeature = new ApiFeatures(Product.find(), req.query).search().filter();

  let products = await apiFeature.query;

  let filteredProductsCount = products.length;

  apiFeature.pagination(resultPerPage);

  products = await apiFeature.query.clone();

  res.status(200).json({
    success: true,
    products,
    productsCount,
    resultPerPage,
    filteredProductsCount,
  });
};

// @desc Get products by categoryId
// @route GET /products/:categoryId
// @access Public
const getProductsByCategoryId = async (req, res) => {
  const startProduct = req.query?.startProduct;
  const limit = req.query?.limit;
  let sort = req.query?.sort;
  sort = sort ? `{"${sort}": 1 }` : '{"rating":1}';

  const { categoryId } = req.params;

  const products = await Product.find({ category: categoryId })
    .sort(JSON.parse(sort))
    .skip(startProduct)
    .limit(limit)
    .populate('category')
    .lean();

  // If no products
  if (!products?.length) {
    return res.status(400).json({ message: 'No products found' });
  }

  res.json(products);
};

// @desc Create new product
// @route POST /products
// @access Private
const createNewProduct = async (req, res) => {
  // console.log(req.body);
  const { title, description, price, category, Stock } = req.body;

  // Confirm data
  if (!title || !description || !price || !category || !Stock) {
    return res.status(400).json({ message: 'All fields except images are required' });
  }

  // Check for duplicate product
  const duplicate = await Product.findOne({ title })
    .collation({ locale: 'en', strength: 2 })
    .lean()
    .exec();

  if (duplicate) {
    return res.status(409).json({ message: 'Duplicate product' });
  }

  // Create and store new product-only 'Manager' or 'Admin'
  if (!req.roles.includes('Manager') || !req.roles.includes('Admin')) {
    return res.status(403).json({ message: 'No access' });
  }

  //create folder uploads and load file
  // console.log('file', req.files);
  // let fileName = '';
  // if (req.files) {
  //   // fileName = uuid() + '_' + req.files.productImg.name;
  //   fileName = req.files.productImg.name;
  //   // req.files.productImg.mv(path.join(__dirname, '..', 'uploads', fileName));
  //   if (!fs.existsSync(path.join(__dirname, '..', 'public', 'uploads'))) {
  //     await fsPromises.mkdir(path.join(__dirname, '..', 'public', 'uploads'));
  //   }
  //   await fsPromises.appendFile(
  //     path.join(__dirname, '..', 'public', 'uploads', fileName),
  //     req.files.productImg.data,
  //   );
  // }
  //==========cloudinary==============
  let images = [];

  if (typeof req.body.images === 'string') {
    images.push(req.body.images);
  } else {
    images = req.body.images;
  }

  const imagesLinks = [];
  if (req.body.images) {
    for (let i = 0; i < images.length; i++) {
      const result = await cloudinary.v2.uploader.upload(images[i], {
        folder: 'products',
      });

      imagesLinks.push({
        public_id: result.public_id,
        url: result.secure_url,
      });
    }

    req.body.images = imagesLinks;
  }

  //===========end cloudinary=========
  const productObject =
    imagesLinks.length > 0
      ? { title, description, price, category, Stock, images: imagesLinks }
      : { title, description, price, category, Stock };

  const product = await Product.create(productObject);

  if (product) {
    //created
    res.status(201).json({ message: `New product ${title} of category   ${category} created` });
  } else {
    res.status(400).json({ message: 'Invalid product data received' });
  }
};

// @desc Update a product
// @route PATCH /products
// @access Private
const updateProduct = async (req, res) => {
  // console.log(req.body);
  const { id, title, description, price, category, Stock } = req.body;

  // Confirm data
  if (!id || !title || !description || !price || !category || !Stock) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Does the user exist to update?
  const product = await Product.findById(id).exec();

  if (!product) {
    return res.status(400).json({ message: 'Product not found' });
  }

  // Check for duplicate title
  const duplicate = await Product.findOne({ title })
    .collation({ locale: 'en', strength: 2 })
    .lean()
    .exec();

  // Allow updates to the original product
  if (duplicate && duplicate?._id.toString() !== id) {
    return res.status(409).json({ message: 'Duplicate title' });
  }

  // Update product-only 'Manager' or 'Admin'
  if (!req.roles.includes('Manager') || !req.roles.includes('Admin')) {
    return res.status(403).json({ message: 'No access' });
  }

  // // load file.if productImg(json file) exists-take it,else exists req.files(form-data) and take itand delete old
  // let fileName = '';
  // if (req.files) {
  //   // console.log(req.files.productImg);
  //   // fileName = uuid() + '_' + req.files.productImg.name;
  //   fileName = req.files.productImg.name;
  //   await fsPromises.appendFile(
  //     path.join(__dirname, '..', 'public', 'uploads', fileName),
  //     req.files.productImg.data,
  //   );
  //   // if (product.productImg) {
  //   //   await fsPromises.unlink(path.join(__dirname, '..', 'public', 'uploads', product.productImg));
  //   // }
  // }

  // Images Start Here
  let images = [];

  if (typeof req.body.images === 'string') {
    images.push(req.body.images);
  } else {
    images = req.body.images;
  }

  const imagesLinks = [];
  if (images !== undefined) {
    // Deleting Images From Cloudinary
    for (let i = 0; i < product.images.length; i++) {
      await cloudinary.v2.uploader.destroy(product.images[i].public_id);
    }

    for (let i = 0; i < images.length; i++) {
      const result = await cloudinary.v2.uploader.upload(images[i], {
        folder: 'products',
      });

      imagesLinks.push({
        public_id: result.public_id,
        url: result.secure_url,
      });
    }

    req.body.images = imagesLinks;
  }

  product.title = title;
  product.description = description;
  product.price = price;
  product.category = category;
  product.Stock = Stock;

  product.images = req.body.images.length > 0 ? req.body.images : [];

  const updatedProduct = await product.save();

  res.json({ message: `${updatedProduct.title} of category ${updatedProduct.category}  updated` });
};

// @desc Delete a product
// @route DELETE /products
// @access Private
const deleteProduct = async (req, res) => {
  // Delete product-only 'Manager' or 'Admin'
  if (!req.roles.includes('Manager') || !req.roles.includes('Admin')) {
    return res.status(403).json({ message: 'No access' });
  }

  const { id } = req.body;

  // Confirm data
  if (!id) {
    return res.status(400).json({ message: 'Product ID Required' });
  }

  // Does the user still have assigned notes?
  //   const note = await Note.findOne({ user: id }).lean().exec();
  //   if (note) {
  //     return res.status(400).json({ message: 'User has assigned notes' });
  //   }

  // Does the user exist to delete?
  const product = await Product.findById(id).exec();

  if (!product) {
    return res.status(400).json({ message: 'Product not found' });
  }
  //в public/uploads находятся все картинки - они не удаляются
  // if (product.productImg) {
  //   await fsPromises.unlink(path.join(__dirname, '..', 'public', 'uploads', product.productImg));
  // }

  //delete images from cloudinary
  for (let i = 0; i < product.images.length; i++) {
    await cloudinary.v2.uploader.destroy(product.images[i].public_id);
  }

  const result = await product.deleteOne();

  const reply = `Product ${result.title} with ID ${result._id} deleted`;

  res.json(reply);
};

// Create New Review or Update the review,route('/review')
const createProductReview = async (req, res, next) => {
  const { rating, comment, productId } = req.body;
  const user = await User.findOne({ email: req.email });
  // console.log(user);

  const review = {
    user: user._id,
    name: user.username,
    rating: Number(rating),
    comment,
  };

  const product = await Product.findById(productId);

  const isReviewed = product.reviews.find((rev) => rev.user.toString() === user._id.toString());

  if (isReviewed) {
    product.reviews.forEach((rev) => {
      if (rev.user.toString() === user._id.toString()) {
        rev.rating = rating;
        rev.comment = comment;
      }
      // (rev.rating = rating), (rev.comment = comment);
    });
  } else {
    product.reviews.push(review);
    product.numOfReviews = product.reviews.length;
  }

  let avg = 0;

  product.reviews.forEach((rev) => {
    avg += rev.rating;
  });

  product.rating = avg / product.reviews.length;

  await product.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
  });
};

// Get All Reviews of a product, route('/reviews/:productId')
const getProductReviews = async (req, res, next) => {
  //productId как  req.params.id
  const product = await Product.findById(req.params.productId);

  if (!product) {
    // return next(new ErrorHandler('Product not found', 404));
    return res.status(404).json({ message: 'Product not found' });
  }

  res.status(200).json({
    success: true,
    reviews: product.reviews,
  });
};

// Delete Review .route('/reviews/:productId')
const deleteReview = async (req, res, next) => {
  //productId as params
  const product = await Product.findById(req.params.productId);

  if (!product) {
    return next(new ErrorHandler('Product not found', 404));
  }

  //id of review as query(get-params)
  //reviews-то что осталось , без id of review
  const reviews = product.reviews.filter((rev) => rev._id.toString() !== req.query.id.toString());

  let avg = 0;

  reviews.forEach((rev) => {
    avg += rev.rating;
  });

  let ratings = 0;

  if (reviews.length === 0) {
    ratings = 0;
  } else {
    ratings = avg / reviews.length;
  }

  const numOfReviews = reviews.length;

  await Product.findByIdAndUpdate(
    req.params.productId,
    {
      reviews,
      rating: ratings,
      numOfReviews,
    },
    {
      new: true,
      runValidators: true,
      useFindAndModify: false,
    },
  );

  res.status(200).json({
    success: true,
  });
};

module.exports = {
  getCount,
  getAllProducts,
  getProducts,
  getProductsByCategoryId,
  createNewProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  getProductReviews,
  deleteReview,
};
