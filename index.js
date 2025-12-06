const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
const admin = require("firebase-admin");
const serviceAccount = require("./firebaseKey.json");
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json())

const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if(!token){
    return res.status(401).send({message: "1 unAuthorized access"})
  }
  try {
    const idToken = token.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken)
    req.userEmail = decoded.email,
    next()
  } catch (error) {
    return res.status(401).send({message: "2 unAuthorized access"})
  }
}

async function run() {
  try {
    await client.connect();

    const contestHubDB = client.db('contestHubDB');
    const usersCollection = contestHubDB.collection('users');

    app.post('/users', verifyFBToken, async (req, res) => {
      try {
        const  user  = req.body;

        user.role = "user";
        user.wins = 0;
        user.createdAt = new Date();

        const query = { email: user.email };
        const existingUser = await usersCollection.findOne(query);
        if (existingUser) {
          return res.status(409).send({ message: "User already exists!" });
        }

        const result = await usersCollection.insertOne(user);
          res.send({success: true, message: "User saved successfully!", result});
        } catch (error) {
          console.error("DB Error:", error);
          res.status(500).send({success: false, message: "Something went wrong!", error: error.message
        });
      }
    });



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {}
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})