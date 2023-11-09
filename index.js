const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const app = express()
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin:[
      // 'http://localhost:5173', 
      // 'http://localhost:5174',
      'https://clean-co-56f4d.web.app',
      'https://clean-co-56f4d.firebaseapp.com'
    ],
    credentials: true
}))
app.use(express.json());
app.use(cookieParser())

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xzggogk.mongodb.net/?retryWrites=true&w=majority`;

// MongoDB Connection
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // connect collection
    const serviceCollection = client.db('CleanCoDB').collection('services')
    const bookingCollection = client.db('CleanCoDB').collection('bookings')

    // middlewares
    // verify token and grant access
    const gateman = (req, res , next) => {
        const { token } = req.cookies

        //if client does not send token
        if(!token){
            return res.status(401).send({message:'unauthorized access'})
        }

        // verify a token symmetric
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
            if(err){
                return res.status(401).send({message:'unauthorized access'})
            }
        // attach decoded user so that others can get it
        // console.log(decoded)
        req.user= decoded
        next()
        })
    }

    // get services and filter by category and sort by price and pagination
    app.get('/api/v1/services', gateman, async (req, res) => {
        let queryObj = {}
        let sortObj = {}

        const category = req.query.category;
        const sortField = req.query.sortField;
        const sortOrder = req.query.sortOrder;

        // pagination
        const page = Number(req.query.page);
        const limit = Number(req.query.limit);
        const skip = (page-1) * limit;

        if(category){
          queryObj.category = category;
        }

        if(sortField && sortOrder){
          sortObj[sortField] = sortOrder;
        }

        const cursor = serviceCollection.find(queryObj).skip(skip).limit(limit).sort(sortObj)
        const result = await cursor.toArray()

        // count data
        const total = await serviceCollection.countDocuments()
        res.send({
          total,
          result
        })
    })

     // get service by id 
     app.get('/api/v1/services/:serviceId', async (req, res) => {
      const id = req.params.serviceId
      const query = { _id: new ObjectId(id) }
      const result = await serviceCollection.findOne(query)
      res.send(result)
    })

    // send create booking
    app.post('/api/v1/user/create-booking', async (req, res) => {
        const booking = req.body;
        const result = await bookingCollection.insertOne(booking)
        res.send(result)
    })

    // user specific bookings
    app.get('/api/v1/user/bookings', gateman, async (req, res) => {
        const queryEmail = req.query.email;
        const tokenEmail = req.user.email
   
        if(queryEmail !== tokenEmail) {
            return res.status(403).send({message:'forbidden access'})
        }

        let query ={}
        if(queryEmail){
         query.email = queryEmail
        }

        const result = await bookingCollection.find(query).toArray()
        res.send(result)
    })

    // delete booking
    app.delete('/api/v1/user/cancel-booking/:bookingId', async (req, res) => {
        const id = req.params.bookingId
        const query = { _id: new ObjectId(id) }
        const result = await bookingCollection.deleteOne(query)
        res.send(result)
    })
    
    // auth related api
    app.post('/api/v1/auth/access-token', (req, res) => {
        // creating token and send to client
        const user = req.body
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: 60 * 60})
        // res.send(token)
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        })
        .send({ success: true })
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Clean Co Server is running')
})

app.listen(port, () => {
  console.log(`Clean Co Server is running on port ${port}`)
})