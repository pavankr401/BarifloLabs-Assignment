require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT
const myDb = require('./connection')
const {ObjectId} = require('mongodb')
const passport = require('passport')
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')


app.use(express.urlencoded({extended: true}))
app.use(express.json())


myDb(async client => {

  const db = client.db('assignment')
  const posts_collection = db.collection('posts')
  const users_collection = db.collection('users')

  app.post('/register', function(req, res){
    const {name, email, password} = req.body

    if(!name || !email || !password) return res.send({status: 'mandatory fields name, email, password'})
    // check if the email already exists
    users_collection.findOne({email: email})
    .then(user => {
      if(user){
        return res.status(400).send({status: 'email already exists'})
      }
      else{
        // hash the password
        bcrypt.genSalt(10, (err, salt) => {
          bcrypt.hash(password, salt, (err, hash) => {
            if(err) throw err;

            // save the new user to db
            users_collection.insertOne({name: name, 
                                        email: email,
                                      password: hash})
              .then(user => {
                // create the JWT payload
                const payload = {id: user.insertedId}

                // sign the JWT
                jwt.sign(payload, 'secret', {expiresIn: '1h' }, (err, token) => {
                  res.json({
                    success: true,
                    token: `Bearer ${token}`
                  })
                })
              })
              .catch(err => console.log(err));
          })
        })
      }

    })
  })

  const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: 'secret'
  }

  const jwtStrategy = new JwtStrategy(options, (payload, done) => {
    // Find the user in the database
    users_collection.findOne({_id: ObjectId(payload.id)})
      .then(user => {
        if (user) {
          done(null, user);
        } else {
          done(null, false);
        }
      })
      .catch(err => console.log(err));
  });
  
  passport.use(jwtStrategy);

  app.use('/route-to-protect', passport.authenticate('jwt', { session: false }), (req, res) => {});

  app.post('/login', (req, res) => {
    const {email, password} = req.body
    if(!email || !password)return res.status(400).send({status: 'missing email or password'})
    
    // Authenticate the user
    users_collection.findOne({ email: email })
      .then(user => {
        if (!user) {
          return res.status(404).json({ email: 'User not found' });
        }
  
        // Compare the password
        bcrypt.compare(password, user.password)
          .then(isMatch => {
            if (isMatch) {
              // Create the JWT payload
              const payload = { id: user.id, name: user.name };
  
              // Sign the JWT
              jwt.sign(
                payload,
                'secret',
                { expiresIn: '1h' },
                (err, token) => {
                  res.json({
                    success: true,
                    token: `Bearer ${token}`
                  });
                });
            } else {
              return res.status(400).json({ status: 'Password incorrect' });
            }
          });
      });
  });
  

  app.get('/', function(req, res){
    res.json({status: 'working on port 3000'})
  })

  // Create the CRUD of Post for the only authenticated user.
  app.post('/story', async function(req,res){
    let {title, body, created_by, status, geo_location} = req.body

    if(!title || !body || !created_by || !status || !geo_location){
      return res.status(400).send({status: 'please consider mandatory fields'})
    }

    geo_location = JSON.parse(geo_location)
    let lat = geo_location[0], lon =  geo_location[1]

    let result = await posts_collection.insertOne({
      title, body, created_by, status, geo_location:{lat:lat, lon:lon}
    })

    res.status(200).send({status: 'post created', _id: result.insertedId})

  })

  app.get('/story', async function(req, res){
    const {_id} = req.query
    let result
    if(_id){
      result = await posts_collection.findOne({_id: ObjectId(_id)}, {projection: {_id: 0, user: 0}})
    }
    else{
      result = await posts_collection.find({user: 'user'}, {projection: {_id: 0, user: 0}}).toArray()
    }
    
     res.status(200).send(result)
  })

  app.put('/story', async function(req,res){
    let {_id, title, body, created_by, status, geo_location} = req.body
    let updateDoc = {}

    if(!_id){
      return res.status(400).send({status: 'we could not update, need ID to update'})
    }

    if(title) updateDoc.title = title
    if(body) updateDoc.body = body
    if(created_by) updateDoc.created_by = created_by
    if(status) updateDoc.status = status
    if(geo_location){
      geo_location = JSON.parse(geo_location)
      let lat = geo_location[0], lon = geo_location[1]
      updateDoc.geo_location = {lat, lon}
    }

    let result = await posts_collection.updateOne({_id: ObjectId(_id)}, {$set: updateDoc})
    res.status(200).send({status: 'post updated'})

  })

  app.delete('/story', async function(req,res){
    const {_id} = req.query

    if(!_id) return res.status(400).send({status: 'need ID to delete'})

    let result = await posts_collection.deleteOne({_id: ObjectId(_id)})
    if(result.deletedCount == 0) res.status(400).send({status: 'no id to delete'})
    else res.status(200).send({status: 'deleted'})
  })


  // Create an API to retrieve posts using latitude and longitude.
  app.get('/get_story', async function(req, res){
    let {lat, lon} = req.query
    if(!lat || !lon) return res.status(400).send({status: 'lat & lon are mandatory fields'})

    let result = await posts_collection.find({user: 'user',geo_location: {lat: Number(lat), lon: Number(lon)}}, {projection: {_id: 0, user: 0}}).toArray()
    res.status(200).send({result})
  })

  // Show the count of active and inactive post in the dashboard.
  app.get('/dashboard', async function(req, res){
    let active = (await posts_collection.find({status: 'active'}).toArray()).length
    let inactive = (await posts_collection.find({status: 'inactive'}).toArray()).length

    res.send({active: active, inactive: inactive})
  })

})



app.listen(port, (err) => {
  if(err) console.log("Error in server setup")
  else console.log('app listening on port number '+ port)
})