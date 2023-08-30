const express = require('express');
const userController = require('./../controller/userController');
const authController = require('./../controller/authController');
const router = express.Router();

router.post('/signup', authController.signup)
router.post('/login', authController.login)

router.post('/forgotPassword', authController.forgotPassword)
router.patch('/resetPassword/:token', authController.resetPassword)

//Middleware runs in sequence means all middlewares next will be authenticated by this function below
router.use(authController.protect);

router.patch('/updateMyPassword', 
  authController.updatePassword
  );

router.get('/me', 
  userController.getMe, 
  userController.getUser);

router.patch('/updateMe', 
  userController.updateMe);

router.delete('/deleteMe', 
  userController.deleteMe);


//All below routes are accessible to only admin
router.use(authController.restrictTo('admin'));
  
router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;