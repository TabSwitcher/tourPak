class APIFeatures {
    constructor(query, queryString) {
        this.query = query;
        this.queryString = queryString;
    };

    filter() {
        //1A) Filtering
        const queryObj = { ...this.queryString }

        const excludedFields = ['page', 'sort', 'limit', 'fields'];

        //we are using foreach bcz we don't want to save a new array
        excludedFields.forEach(el => delete queryObj[el])

        //1B) ADVANCED FILTERING


        //{ difficulty: 'easy', duration: {gte: 5} }  
        //{ difficulty: 'easy', duration: {$gte: 5} }

        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`)

        //.find returns ENTRE QUERY if and only if we don't put await before it, implement like this to use pagination etc bcz for that we want the entire query not the awaited cut out query

        this.query = this.query.find(JSON.parse(queryStr));
        //let query = Tour.find(JSON.parse(queryStr));

        return this; //simply returns entire object so that sort can be chained
    }

    sort() {
        //2) SORTING
        if (this.queryString.sort) {
            //127.0.0.1:3000/api/v1/tours/?sort=price,ratingAverage
            //in mongoose .sort('price ratingsAverage')  
            const sortBy = this.queryString.sort.split(',').join(' ');
            this.query = this.query.sort(sortBy);
        } else {
            this.query = this.query.sort('-createdAt');
        }
        return this;
    }

    limitFields() {
        //3) FIELD LIMITING
        if (this.queryString.fields) {

            //This operation of selecting field names is called projecting
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields);
        } else {
            // - means excluding __v field
            this.query = this.query.select('-__v');
        }
        return this;
    }

    paginate() {
               // 4)PAGINATION

        //Here we convert string to num by * 1 and we've a nice way to 
        //add default vals in js by using || so after or we specified 
        //the default page no to be 1

        const page = this.queryString.page * 1 || 1;
        const limit = Number(this.queryString.limit * 1) || 100;

        //page=3&limit=10, 1-10, page 1, 11-20, page2, 21-30, page 3
        const skip = (page - 1) * limit;

        this.query = this.query.skip(skip).limit(limit);
        return this;
    }
}

module.exports = APIFeatures;