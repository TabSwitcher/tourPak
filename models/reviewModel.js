const mongoose = require('mongoose');
const Tour = require('./../models/tourModel');

const reviewSchema = new mongoose.Schema({
    review: {
        type: String,
        trim: true,
        required: [true, 'Please provide a review']
    },
    rating: {
        type: Number,
        min: [1, 'Rating must be above 1'],
        max: [5, 'Rating must be below 5'],
        required: [true, 'Please provide rating']
    },
    createdAt: {
        type: Date,
        default: Date.now(),
        required: true,
    },
    tour:   {
            type: mongoose.Schema.ObjectId,
            ref: 'Tour',
            required: [true, 'Review must belong to a tour']
        },
    user:   {
                type: mongoose.Schema.ObjectId,
                ref: 'User',
                required: [true, 'Review must belong to a user']
        }
},
{
    //when've a virtual property (field that's calculated but not stored in db), we want it to be part of outputs
    toJSON: { virtuals: true },
    toObject: { virtuals: true } //when data gets outputted as an obj
});

reviewSchema.pre(/^find/, function(next){
    // this.populate({
    //     path: 'tour',
    //     select: 'name'
    // }).populate({
    //     path: 'user',
    //     select: 'name photo', //only leak relevant data no need for email password leak here
    // })
    // next();

    //Our review virtual property was being populated with tours in tourModels creating a mess so we turned it off here
    this.populate({
        path: 'user',
        select: 'name photo', //only leak relevant data no need for email password leak here
    })
    next();
})

reviewSchema.statics.calcAverageRatings = async function(tourId){
//In a static method the this variable calls exactly tour method - very handy in these cases
    
    const stats = await this.aggregate([
        {
            $match: {tour: tourId}
        },
        {
            $group: {
                _id: '$tour',
                nRating: { $sum: 1 },
                avgRating: {$avg: '$rating'},
            }
        }
    ]);
   // console.log(stats);
    
    if(stats.length > 0){
        await Tour.findByIdAndUpdate(tourId, {
            ratingsQuanity: stats[0].nRating,
            ratingsAverage: stats[0].avgRating
        });
    } else {
        await Tour.findByIdAndUpdate(tourId, {
            ratingsQuanity: 0,
            ratingsAverage: 4.5
        });
    }
}

//Each combination of tour and user needs to be unique. To avoid multiple reviews of 1 tour from 1 user
reviewSchema.index({ tour: 1, user: 1}, { unique: true });

//When all reviews are saved in database after that it's best to do this calculation with all the reviews all ready, bcz in presave the current review is not in the collection just yet
//Post middleware doesnt use next
reviewSchema.post('save', function() {
    //this points to current review

    this.constructor.calcAverageRatings(this.tour);
    //Review.calcAverageRatings(this.tour);
    //We can call statics method like Review.calc but here Review is not created yet it's created in line below, so there's another name for the current model which is this.constructor which constructs the model.
})

//Update and deleting reviews can be difficult but we can workaround this too
//For update and delete we don't have any document middleware to use we only have query middleware and that too doesn't point to the document so we use a hack using findOne


//We actually want to calculate avg after all data has saved but we've no access to query in post function so we do it in the next function
//findByIdAndUpdate
//findByIdAndDelete
reviewSchema.pre(/^findOneAnd/, async function(next) {
    //const r = await this.findOne(); //returns document being processed
    
    //here we create .r property storing current document into current query variable
    this.r = await this.findOne();
   // console.log(this.r);
    next();
})

//Now we need to pass the rating "r" from pre middleware to post
//THERE IS A TRICK TO PASS DATA FROM PRE MIDDLEWARE TO POST. USE THIS WITH OBJ U WANT TO PASS

reviewSchema.post(/^findOneAnd/, async function(){
///await this.findOne() does NOT work here, query has already executed   
    await this.r.constructor.calcAverageRatings(this.r.tour);
})

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
