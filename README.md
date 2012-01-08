# A SoundCloud experiment

## Info
This is a web application for mobile devices to interact with SoundCloud. You can:
* Search and play tracks
* Tag them
* Create playlists

DISCLAIMER
This is work-in-progress! Not all of the stuff is working as intended, but over time, it will.

## Demo
Point your browser to http://soundcloudxperiment.herokuapp.com and play!

## Technical Details
This project is a single-page web application with all of the logic handled on the client side. The technology stack is:

* Rails (minimal) + Compass
* jQuery
* jQuery Mobile
* Backbone.js
* Handlebars

Navigation between the pages is HTML5 History-compliant. You can perform actions and hit the back/forward buttons without leaving the page.
When you tag a track or add it to a playlist, it is added to a Library stored in HTML localStorage.
At the moment you can't see your playlists on another computer and if multiple users use the app, things will mix up. Work is ongoing!