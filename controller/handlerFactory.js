//We need to create a function which returns a function for all functionalities like deletetours, delete users etc. We'll pass a model into the factory function
const catchAsync = require('./../utils/CatchAsync');
const AppError = require('./../utils/AppError');
const APIFeatures = require('./../utils/AppFeatures');


exports.deleteOne = Model => 
    catchAsync(async (req, res, next) => {
        const doc = await Model.findByIdAndDelete(req.params.id)
        
        if (!doc) {
            return next(new AppError('No document found with that ID', 404))
        }

        res.status(204).json({
            status: 'success',
            data: null
        });
});


//exports.deleteTour = tour => catchAsync(async (req, res, next) => {
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

exports.updateOne = Model => catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        //new: true returns new updated document
        runValidators: true
        //runs validators in schema again
    });

    if (!doc) {
        return next(new AppError('No document found with that ID', 404))
    }


    res.status(200).json({
        status: 'success',
        data: {
            data: doc
        }
    });
});

exports.createOne = Model => catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body);
    
    res.status(201).json({
        status: 'success',
        data: {
            data: doc
        }
    });
});

exports.getOne = (Model, popOptions) => 
    catchAsync(async (req, res, next) => {
        //As reviews is a virtual field so we populate it only when requesting query on one tour only
        let query = Model.findById(req.params.id);
            // Tour.findOne({_id: req.params.id})  
        
        if (popOptions) query = query.populate(popOptions);
        
        const doc = await query;    
        if (!doc) {
            return next(new AppError('No document found with that ID', 404))
        }
            //always need return we don't want to have two responses lol
        
        res.status(200).json({
            status: 'success',
            data: {
                data: doc
            }
        })
});

exports.getAll = Model => 
    catchAsync(async (req, res, next) => {
        //Small hack To allow for nested get reviews on Tour
        //If we are not on the review route so there'll be no filter 
        let filter = {}
        if (req.params.tourId) filter = { tour: req.params.tourId }    
        
        //BUILD QUERY IN API FEATURES

        //Tour.find() passes the query object, after building it up, that query now lives in features which we then await to execute
        const features = new APIFeatures(Model.find(filter), req.query)
            .filter()
            .sort()
            .limitFields()
            .paginate();

        //EXECUTE QUERY
        // const doc = await features.query.explain();
        const doc = await features.query;

        //SEND RESPONSE
        res.status(200).json({
            status: 'success',
            results: doc.length,
            data: {
                data: doc
            }
        });
});