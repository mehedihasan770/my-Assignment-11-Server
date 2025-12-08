const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const allContests = contestHubDB.collection('contests')

    app.post('/users', verifyFBToken, async (req, res) => {
      try {
        const  user  = req.body;
        const userEmail = req.userEmail;

        if(user.email !== userEmail){
          return res.status(403).send({ message: "Forbidden access" });
        }

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

    app.get('/users', verifyFBToken, async (req, res) => {
        try{
          const result = await usersCollection.find().toArray();
          res.send(result)
        } catch(err) {
          res.status(500).send({ success: false, message: 'Server error' })
        }
    });

    app.patch('/users/:id',verifyFBToken, async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;
      try {
        const result = await usersCollection.updateOne({_id: new ObjectId(id)},{ $set: {role} });
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: 'Server error' });
      }
    });

    app.get('/users/role/:email', verifyFBToken, async (req, res) => {
      const email = req.params.email;
      try {
        if (email !== req.userEmail) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        const user = await usersCollection.findOne({ email });
        res.send({ role: user?.role });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    app.post("/contests/:email/:role", verifyFBToken, async (req, res) => {
      try {
        const contest = req.body;
        const { email, role } = req.params;
        if (role !== 'creator') {
          return res.status(403).send({ message: "Forbidden Access: Invalid role" });
        }
        if (email !== req.userEmail) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        const result = await allContests.insertOne(contest);
        res.send({id: result.insertedId});
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    app.get("/contests/:email/creator", verifyFBToken, async (req, res) => {
      try {
        const creatorEmail = req.params.email;
        console.log(creatorEmail)

        if (creatorEmail !== req.userEmail) {
          return res.status(403).send({ message: "Forbidden Access" });
        }

        const result = await allContests
          .find({ creator_email: creatorEmail })
          .sort({ created_at: -1 })
          .toArray();
          res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Server Error", error: err.message });
      }
    });

    app.get("/contests/:id/task", verifyFBToken, async (req, res) => {
      try {
        const id = req.params.id;

        const result = await allContests
          .findOne({ _id: new ObjectId(id) })
          res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Server Error", error: err.message });
      }
    });

    app.patch("/contests/:id/:email/winner", verifyFBToken, async (req, res) => {
      const { id, email } = req.params;
      try {
        const result = await allContests.updateOne(
          {_id: new ObjectId(id), "submissionsTask.participant.email": email,},
          { $set: { "submissionsTask.$.isWinner": true } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({success: false,message: error.message});
      }
    });

    app.patch('/contests/:id/contest',verifyFBToken, async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      console.log('hallo')
      try {
        const result = await allContests.updateOne({_id: new ObjectId(id)},{ $set: updateData });
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: 'Server error' });
      }
    });
    
    app.delete('/contests/:id/delete', verifyFBToken, async (req, res) => {
      const { id } = req.params;
      try {
        const result = await allContests.deleteOne({ _id: new ObjectId(id)});
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: 'Server error' });
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