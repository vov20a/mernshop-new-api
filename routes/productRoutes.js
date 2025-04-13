const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');
const verifyJWT = require('../middlewares/verifyJWT');

router.use(verifyJWT);

router.route('/count').get(productsController.getCount);

router.route('/:categoryId').get(productsController.getProductsByCategoryId);

router.route('/').get(productsController.getAllProducts);
//the same method
router.route('/all/products').get(productsController.getProducts);

router
  .route('/')
  .post(productsController.createNewProduct)
  .patch(productsController.updateProduct)
  .delete(productsController.deleteProduct);

router.route('/review').patch(productsController.createProductReview);
router
  .route('/reviews/:productId')
  .get(productsController.getProductReviews)
  .delete(productsController.deleteReview);

module.exports = router;
