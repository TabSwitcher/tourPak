const AppError = require('./../utils/AppError');
const Tour = require('./../models/tourModel');
const APIFeatures = require('./../utils/AppFeatures');
const catchAsync = require('./../utils/CatchAsync');
const factory = require('./handlerFactory');

exports.aliasTopTours = (req, res, next) => {
    //prefils these properties of the query object before we reach getAllTours handler
    req.query.limit = '5';
    req.query.sort = '-ratingsAverage,price';
    req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
    console.log('success')
    next();

}
// exports.checkID = (req, res, next, val) => {
//     console.log(`Tour id is: ${val}`)
//     if (req.params.id * 1 > tours.length){
//         return res.status(404).json({
//             status: 'fail',
//             message: 'Invalid ID'
//         });
//     };
//     next();
// }


exports.getAllTours = factory.getAll(Tour);

exports.getTour = factory.getOne(Tour, {path: 'reviews' })

//We returned a func from catchAsync and saved it into 
//create Tour bcz we want express to run it later on

exports.createTour = factory.createOne(Tour);

exports.updateTour = factory.updateOne(Tour);

// exports.deleteTour = catchAsync(async (req, res, next) => {
//     const tour = await Tour.findByIdAndDelete(req.params.id)
    
//     if (!tour) {
//         return next(new AppError('No tour found with that ID', 404))
//     }

//     res.status(204).json({
//         status: 'success',
//         data: {
//             tour
//         }
//     });
// });

exports.deleteTour = factory.deleteOne(Tour);

// AGGREGATING PIPELINE
exports.getTourStats = catchAsync(async (req, res, next) => {
    const stats = await Tour.aggregate([
        {
            $match: { ratingsAverage: { $gte: 4.5 } }
        },
        {
            $group: {
                //these all are just accumulators
                _id: { $toUpper: '$difficulty' },
                //with every document passing through this pipeline, 1 will be added to numTours
                numTours: { $sum: 1 },
                numRatings: { $sum: '$ratingsQuantity' },
                avgRating: { $avg: '$ratingsAverage' },
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
            }
        },
        {
            $sort: { avgPrice: 1 } //1 for ascending
        },
        // {
        //     //select all documents which are not easy
        //     $match: { _id: {$ne : 'EASY'}} 
        // }
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            stats
        }
    });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
    const year = req.params.year * 1; //2021
    const plan = await Tour.aggregate([
        {
            //one same document for each startdate array item
            $unwind: '$startDates'
        },
        {
            $match: {
                startDates: {
                    //for year 2021 start to end
                    $gte: new Date(`${year}-01-01`),
                    $lte: new Date(`${year}-12-31`)
                }
            }
        },
        {
            $group: {
                _id: { $month: '$startDates' }, //categorize by month
                numTourStarts: { $sum: 1 }, //add all tours for that month
                tours: { $push: '$name' } //add tour names to array in that month category
            }
        },
        {
            $addFields: { month: '$_id' }
        },
        {
            $project: {
                _id: 0 //not show id
            }
        },
        {
            $sort: { numTourStarts: - 1 } //descending
        },
        {
            $limit: 12 //Allows only 12 documents
        }

    ]);

    res.status(200).json({
        status: 'success',
        data: {
            plan
        }
    });
});

// /tours-within/236/center/-40,45/unit/mi
// /tours-within/:distance/center/:latlng/unit/:unit
// sphere with center--> latlng & radius--> distance
exports.getTourWithin = catchAsync(async (req, res, next) => {
    const { distance, latlng, unit } = req.params;
    const [lat, lng] = latlng.split(',');
  
    const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;
    // radius should be radian--> distance / radius of earth
  
    if (!lat || !lng) {
      next(
        new AppError(
          'Please provide latitude and longitude in the format lat,lng',
          400
        )
      );
    }
  
    const tours = await Tour.find({
      startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
    });
  
    // console.log(distance, latlng, unit);
  
    res.status(200).json({
      status: 'success',
      length: tours.length,
      data: {
        data: tours,
      },
    });
  });

// /tours-within/:distance/center/:latlng/unit/:unit
exports.getDistances = catchAsync(async (req, res, next) => {
    const { latlng, unit } = req.params;
    const [lat, lng] = latlng.split(',');
  
    const multiplier = unit === 'mi' ? 0.000621371 : 0.001;
  
    if (!lat || !lng) {
      next(
        new AppError(
          'Please provide latitude and longitude in the format lat,lng',
          400
        )
      );
    }
  
    const distances = await Tour.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [lng * 1, lat * 1],
          },
          distanceField: 'distance', // contains calculated distance
          distanceMultiplier: multiplier, // m--> k.m, m--> mi
        },
      },
      {
        $project: {
          distance: 1,
          name: 1, // only get these fields
        },
      },
    ]);
  
    res.status(200).json({
      status: 'success',
      data: {
        data: distances,
      },
    });
  });