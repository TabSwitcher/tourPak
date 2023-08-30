const Review = require('./../models/reviewModel');
// const catchAsync = require('./../utils/CatchAsync');
const factory = require('./handlerFactory');



exports.setTourUserIds = (req, res, next) => {
    if(!req.body.tour) req.body.tour = req.params.tourId;
    if(!req.body.user) req.body.user = req.user.id;  //req.user comes from protect middleware
    next();

    //We just created this middleware before createReview function to apply factory function to create review
}

// exports.createReview = catchAsync(async (req, res, next) => {
//     //Nested Routes
//     if(!req.body.tour) req.body.tour = req.params.tourId;
//     if(!req.body.user) req.body.user = req.user.id;
//     const newReview = await Review.create(req.body);
    
//     res.status(201).json({
//         status: 'Success',
//         data: {
//             review: newReview
//         }
//     })
// });

exports.getAllReviews = factory.getAll(Review);

exports.deleteReview = factory.deleteOne(Review);

exports.updateReview = factory.updateOne(Review);

exports.createReview = factory.createOne(Review);

exports.getReview = factory.getOne(Review);