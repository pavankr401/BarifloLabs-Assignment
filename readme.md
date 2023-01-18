# Assignment
## API
`/register`<br>
we have to register a account with name, email, password

`/login`<br>
we can login using email and password

`/story`<br>
for post request we have to give title, body, created_by, status - active/inactive, geo_location in array [lat, lon] form<br>

for get request we get the all story, if you want particular story, we have to give the _id<br>

for put request we can update, but _id is mandatory<br>

for delete request _id is mandatory<br>

`/get_story`<br>
lat and lon is mandatory for the query<br>

`/dashboard`<br>
this route gives us active and inactive users count<br>

## Database model
### users collection fields
name, email, password<br>

### posts collection fields
title, body, created_by, status, geo_location : {lat: a, lon: b}

