const mongoose = require('mongoose');
const slugify = require('slugify');
const validator = require('validator');
const User = require('./userModel');

//validator.js is a good library for data validation
const tourSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'A tour must have a name'],
        unique: true,
        trim: true,
        maxLength: [40, 'A tour name must have less or equal than 40 characters'],
        minLength: [10, 'A tour name must have more or equal than 10 characters'],
   //     validate: [validator.isAlpha, 'Tour name must only contain characters']  validator function and message can be in form of object or an array
        //validate keyword calls as soon as data should be validated we dont call
    },
    slug: String,
    duration: {
        type: Number,
        required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
        type: Number,
        required: [true, 'A tour must have a group size']
    },
    difficulty:{
        type: String,
        required: [true, 'A tour must have a difficulty'],
        enum:{ 
            values: ['easy', 'medium', 'difficult'],
            message: 'Difficulty is either: easy, medium, difficult' 
            //this validator only allows these values
            }
    },
    ratingsAverage: {
        type: Number,
        default: 4.5,
        min: [1, 'Rating must be above 1.0'],
        max: [5, 'Rating must be below 5.0'],
        set: val => Math.round(val * 10) / 10 //runs every time when thrz a new val => setter func 
    },
    ratingsQuanity:{
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        required: [true, 'A tour must have a price']
    },
    priceDiscount: {
        type: Number,
        //Custom validator
        //we need this var to point to doc variable so we dont use arrow func
        validate:{ 
           validator: function(val){
                return val < this.price; //100 < 200 returns true => no error
                //wont work on update, this only works with create document
                //THIS ONLY POINTS TO CURRENT DOC ON NEW DOCUMENT CREATION
            },
            message: 'Discount price ({VALUE}) should be below regular price',
            //this VALUE will get value from val variable in method above
        }
    },
    summary: {
        type: String,
        trim: true, //removes all beginning and end white space 
        required: [true, 'A tour must have a description']
    },
    desc: {
        type: String,
        trim: true,
    },
    imageCover: {
        type: String,
        required: [true, 'A tour must have a cover Image']
    },
    images: [String], //defins an array of Strings
    createdAt: {
        type: Date,
        default: Date.now(),
        select: false //user wont be able to see it
    },
    startDates: [Date],
    secretTour: {
        type: Boolean,
        default: false
    },
    startLocation: {
        // GeoJSON
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
      },
      locations: [
        {
          type: {
            type: String,
            default: 'Point',
            enum: ['Point'],
          },
          coordinates: [Number],
          address: String,
          description: String,
        },
      ],
      guides: [
        {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
        },
      ],
}, {
    //each time data is outputted as json we want virtuals to be part of of output
    toJSON: { virtuals: true },
    toObject: { virtuals: true } //when data gets outputted as an obj
});
//1 for ascending -1 for descending
tourSchema.index({price: 1, ratingsAverage: -1})

tourSchema.index({ startLocation: '2dsphere' })

//use index for most queried fields as it wont scan the entire document but indexes also are resource intensive so only use em wisely
tourSchema.index({ slug: 1 })

//WE CAN'T USE VIRTUAL PROPERTIES IN QUERIES BCZ ITS NOT PART OF DB

//DONT USE ARROW FUNC WITH .GET() BCZ ARROW FUNC DOESNT HAVE "THIS"
tourSchema.virtual('durationWeeks').get(function (){
    //this will be pointing to current document
    return this.duration / 7
});

//With parent referencing there's no way for a parent to know its children  bcz children point to parent onesided ONLY
//So For a parent to know its children, we store virtual reviews in parent User 
tourSchema.virtual('reviews', {
    ref: 'Review',     
    foreignField: 'tour', //field in reviews where reference of parent is stored
    localField: '_id' //The field's name in CURRENT model through which we made a reference in child modal
    //So _id in local modal is called tour in review modal (child)
});

//DOCUMENT MIDDLEWARE: runs before .save() and .create() command.
//Runs before we save data to database
//THis middleware wont be executed on .insertMany() command or findByIdANDUpdate();

tourSchema.pre('save', function(next) {
    this.slug = slugify(this.name, { lower: true });
    next();
});

//EMBEDDING users in tours
//  tourSchema.pre('save', async function(next){
//      const guidesPromises = this.guides.map(async id => await User.findById(id));
//      //returns array of promises
//      this.guides = await Promise.all(guidesPromises);
//      next();
//  })

// tourSchema.pre('save', function(next){
//     console.log('Will save document...');
//     next();
// })

// //Post middleware funcs are executed after pre middleware funcs
// tourSchema.post('save', function(doc, next){
//     console.log(doc);
//     next();
// })

//QUERY MIDDLEWARE
//This will here point to current query not document
//Will be executed after building query up and before executing query
//which means just before "await query" in controller it'll hook the query using 'find' keyword

tourSchema.pre(/^find/, function(next){
   //this is a query objects so all methods of query can be applied
    this.find({ secretTour: { $ne: true} });

    this.start = Date.now();
    next();
})

//But it won't work on findById bcz the handler function is different from find (getTour vs getAllTours)
//tourSchema.pre('findOne', function)
//But this ain't better so we better use regular expression 
// /^find/ which simply tells that all execute all functions who's name start with find in method

tourSchema.pre(/^find/, function (next) {
    this.populate({
      path: 'guides',
      select: '-__v -passwordChangedAt',
    });
    next();
});

//we get access to documents returned from query
tourSchema.post(/^find/, function(docs, next){
    console.log(`Query Took: ${Date.now() - this.start} milliseconds`);
    next();
});


//AGGREGATION Middleware
//Before aggregation is executed
tourSchema.pre('aggregate', function(next){
//unshift adds element at beginning of array    
    this.pipeline().unshift({  $match:{ secretTour: { $ne: true} } })
    console.log(this.pipeline());
    next();
})


const Tour = mongoose.model('Tour', tourSchema); 

module.exports = Tour;