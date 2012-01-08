$(function(){
   //----------------MODELS
   /**
   * Backbone model for Soundcloud tracks
   */
   var Track = Backbone.Model.extend({
     addTag: function(tag){
        if(!_.include(this.get('tags'), tag)){
           var arr = this.get('tags');
           arr.push(tag);
           this.set({tags: arr})
        }
        this.trigger('tagsChanged');
     },
     removeTag: function(tag){
        if(_.include(this.get('tags'), tag)){
           this.set({
              tags: _.without(this.get('tags'), tag)
           });
        }
        this.trigger('tagsChanged');
     },
     initialize: function(){
        if(!this.get('tags')){
           var libTrack = trackLibrary.get(this.get('id'));
           var initTags = [];
           if(libTrack){
              initTags = libTrack.get('tags');
           }
           this.set({
              tags: initTags
           })
        }
        this.bind('tagsChanged', this.syncTrack, this); //when tags are added to a track, it is persisted in the trackLibrary
     },
     syncTrack: function(){
        window.trackLibrary.syncTrack(this);
     }
   });
   
   
   /**
      Just a collection of Tracks
   */
   var TrackCollection = Backbone.Collection.extend({
      model: Track
   });

   /**
      A track library is a central model to store track metadata. It is stored in HTML5 localStorage.
      Tracks are added to the library when they're tagged or added to a playlist
   */
   var TrackLibrary = Backbone.Collection.extend({
     model: Track,
     localStorage: new Store("trackLibrary"),
     syncTrack: function(track){
        var libTrack = this.get(track.get('id'));
        if(libTrack){
           libTrack.set(track);
           libTrack.save();
        }else{
           this.create(track.toJSON());
        }
     }
   });

   /**
      An ordered collection of tracks.
      Only track ID's are stored.
   */
   var Playlist = Backbone.Model.extend({
     addTrack: function(track){
        var tracks = this.get('tracks');
        if(!_.include(tracks, track.get('id'))){ //track not already there... no duplicates!
           tracks.push(track.get('id'));
           trackLibrary.syncTrack(track);
           this.save();
        }
     },
     initialize: function(obj){
        this.set(obj);
        if(!this.get('tracks')){
           this.set({
              tracks: []
           })
        }
     }
   });
   
   /**
      A HTML5 storage-persisted library of playlists
   */
   var PlaylistLibrary = Backbone.Collection.extend({
     model: Playlist,
     localStorage: new Store("playlistLibrary"),

     getByTitle: function(title){
        return this.find(function(el){return el.get('title')==title})
     }
   });
   
   //model initialization
   window.trackLibrary = new TrackLibrary;
   window.playlistLibrary = new PlaylistLibrary;



   //------------VIEWS---------------------------//
   //1-Main menu
   var MenuView = Backbone.View.extend({
      el: $("#mainView"),
      template: Handlebars.compile($("#menu-template").html()),
      
      render: function() {
         var tmpHtml = this.template({
            isConnected: SC.isConnected()
         });
         $el = $(this.el);
         $el.html(tmpHtml);
         $el.trigger('create'); //jqueryMobile init
         $("#mainFooter").hide();
      }
   });
   var menuView = new MenuView; //can be cached here


   //2-SearchView: Track Search
   var SearchView = Backbone.View.extend({
      el: $("#mainView"),
      template: Handlebars.compile($("#search-template").html()),
      footerTemplate: Handlebars.compile($("#searchFooter-template").html()),
      footerView: null,
      query: null,
      resTracksView: null,
      
      events: {
         "change #searchInput"    : "launchSearch"
      },
      
      launchSearch: function(e){
         var query = e.currentTarget.value;
         appRouter.navigate('search/'+query, true);
      },
      getSelectedTrack: function(){
         return this.selectedTrack;
      },
      setSelectedTrack: function(track){
         var oldSel = this.selectedTrack;
         this.selectedTrack = track;
         track.trigger('selected',track);
         if(oldSel){
            oldSel.trigger('selected', oldSel); //FIXME could be 'deselected'...
         }
         if(!this.constructor.prototype.footerView){
            this.constructor.prototype.footerView = new SearchFooterView();
            this.constructor.prototype.footerView.show();
         }
      },
      searchTracks: function(query){
            $.ajax({
               url: 'http://api.soundcloud.com/tracks.json',
               dataType: 'jsonp',
               data: {
                  q: query,
                  client_id: SC.options.client_id
               },
               error: function(res, status, xhr){
                  //TODO
               },
               success:function(res, status, xhr){
                  var resTracks = new TrackCollection; //in the closure scope
                  resTracks.add(res);
                  searchView.resTracksView = new SearchResultsView({
                     model: resTracks
                  });
                  searchView.resTracksView.render(); 
                  searchView.query = query;
               }
            })
      },
      
      render: function() {
         var tmpHtml = this.template();
         $el = $(this.el);
         $el.html(tmpHtml);
         $el.trigger('create'); //jqueryMobile init
         if(this.query){ //init results, if route contains a query
            this.resTracksView.render();
         }
      }
   });
   var searchView = new SearchView;
   
   //2.1-SearchResultsView: A collection of search results
   var SearchResultsView = Backbone.View.extend({
      trackViews: {}, // maps track ID's to TrackView's
      render: function() {
         var $el = $("#searchResults");
         $el.html(''); //empty results
         var selectedTrack = searchView.getSelectedTrack();
         var selId = selectedTrack? selectedTrack.get('id') : null;
         //add single TrackViews
         (function(scope){
            scope.model.each(function(element, index, list){
               var trackLi = $("<li class='track-li'></li>");
               $el.append(trackLi);
               var trackView = new TrackView({
                  model:{
                     el: trackLi,
                     track: element,
                     parentView: scope
                  }
               });
               scope.trackViews[element.attributes.id] = trackView;
               trackView.render();
            })
         })(this);
         $el.trigger('create'); //jqueryMobile init
      }
   });

   //2.1.1-TrackView: single tracks
   var TrackView = Backbone.View.extend({
      template: Handlebars.compile($("#track-template").html()),
      events: {
         "click .ui-icon-play"  : 'togglePlay',
         "click .ui-icon-pause" : 'togglePlay',
         "click .track-entry"    : 'selectTrack',
      },
      
      selectTrack: function(e){
         searchView.setSelectedTrack(this.model.track);
      },
      
      togglePlay: function(){
         if(!this.model.track.get('streamable')){
            return;
         }
         if(this.model.track.get("playing")){
            this.soundObj.pause();
            this.model.track.set({
               playing: false
            })
         }else{
            (function(scope){
               SC.whenStreamingReady(function(){
                  if(!scope.soundObj){
                     scope.soundObj = SC.stream(scope.model.track.id);
                  }
                  scope.soundObj.play();
                  scope.model.track.set({
                     playing: true
                  })
               });
            })(this);
         }
      },
      
      initialize: function(){
         this.el = this.model.el;
         this.delegateEvents(this.events);
         this.model.track.bind('change', this.render, this);
         this.model.track.bind('selected', this.render, this);
      },
      
      render: function() {
         var trackJSON = this.model.track.toJSON();
         var selTrack = searchView.getSelectedTrack();
         if(selTrack && selTrack.get('id')==trackJSON.id){
            trackJSON.selected=true;
         }
         var tmpHtml = this.template(trackJSON);
         $el = $(this.el);
         $el.html(tmpHtml);
         $el.trigger('create'); //jqueryMobile init
      }
   });
   
   //3-SearchFooterView: Footer shown at the bottom of the search page
   var SearchFooterView = Backbone.View.extend({
      el: $("#mainFooter"),
      template: Handlebars.compile($("#searchFooter-template").html()),
      events:{
         "click #addTrack" : "addTrack",
         "click #tagTrack" : "tagTrack"
      },
      
      addTrack: function(e){
         var selTrack = searchView.getSelectedTrack();
         this.addToPlaylistView.render();
         this.addToPlaylistView.trigger('create');
         $.mobile.changePage($('#addToPlaylistDialog'),{
            role: 'dialog',
            changeHash: false,
            allowSamePageTransition: true
         });
         e.stopImmediatePropagation();
      },
      
      tagTrack: function(e){
         var selTrack = searchView.getSelectedTrack();
         this.trackTagsView = new TrackTagsView({
            model: {
               track: trackLibrary.get(selTrack.get('id')) || selTrack
            }
         });
         this.trackTagsView.render();
         this.trackTagsView.trigger('create');
         $.mobile.changePage($('#trackTagsDialog'),{
            role: 'dialog',
            changeHash: false,
            allowSamePageTransition: true
         });
      },
      
      initialize: function(){
         this.addToPlaylistView = new AddToPlaylistView({
            model: playlistLibrary
         });
         this.render();
         $(this.el).hide();
      },
      
      show: function(track,b,c){
         $(this.el).show();
      },
      
      render: function() {
         var tmpHtml = this.template();
         $el = $(this.el);
         $el.html(tmpHtml);
         $el.trigger('create');
      }
   });
   
   //4-TrackTagsView: "Track tags" dialog
   var TrackTagsView = Backbone.View.extend({
      el: $("#trackTagsDiv"),
      template: Handlebars.compile($("#trackTags-template").html()),
      events:{
         "keypress #newTag" : "addTag",
         "click .tagEntry" : "removeTag"
      },
      
      addTag: function(e){
         if(e.keyCode==13){
            this.model.track.addTag(e.currentTarget.value);
         }
      },
      removeTag:function(e){
         var tag = $(e.currentTarget).data("tag");
         this.model.track.removeTag(tag);
      },
      initialize: function(){
         this.model.track.bind('tagsChanged', this.render, this);
      },
      render: function() {
         var selTrack = this.model.track;
         var libTrack = trackLibrary.get(selTrack.get('id')) || selTrack;
         
         var tmpHtml = this.template({
            tags: libTrack.get('tags'),
            track: libTrack.toJSON()
         });
         $el = $(this.el);
         $el.html(tmpHtml);
         setTimeout(function(){
            $el.trigger('create'); //fixes a timing issue with decoration of dialogs
         });
      }
   });
   
   //5-AddToPlaylistView - "Add to Playlist" dialog
   var AddToPlaylistView = Backbone.View.extend({
      el: $("#addToPlaylistDiv"),
      template: Handlebars.compile($("#addToPlaylist-template").html()),
      events: {
         "keypress #newPlaylist" : "addPlaylist",
         "click .playlistEntry" : "addToPlaylist"
      },
      
      addPlaylist: function(e){
         if(e.keyCode==13){
            var title = e.currentTarget.value;
            var playlist = playlistLibrary.getByTitle(title);
            if(!playlist){
               playlistLibrary.create({
                  title: title
               })
               playlistLibrary.trigger('change');
            }
         }
      },
      addToPlaylist: function(e){
         var plId = $(e.currentTarget).data("playlist");
         var playlist = playlistLibrary.get(plId);
         var track = searchView.getSelectedTrack();
         playlist.addTrack(track);
      },
      initialize: function(){
         playlistLibrary.bind('change', this.render, this);
      },
      render: function() {
         var modelJSON = this.model.toJSON();
         var playlists = _.map(modelJSON, function(pl){ 
            return {
               id: pl.id,
               title: pl.title
            }
         });
         var tmpHtml = this.template({
            playlists: playlists
         });
         $el = $(this.el);
         $el.html(tmpHtml);
         setTimeout(function(){
            $el.trigger('create'); //fixes a timing issue with decoration of dialogs
         });
      }
   });
   
   //6-PlaylistsView - Playlists listing
   var PlaylistsView = Backbone.View.extend({
      el: $("#mainView"),
      template: Handlebars.compile($("#playlists-template").html()),
      footerTemplate: Handlebars.compile($("#searchFooter-template").html()),
      footerView: null, //unused ATM
      events: {
         "click .playlistEntry"    : "showPlaylist"
      },
      
      showPlaylist: function(e){
         var plId = $(e.currentTarget).data("playlist");
         appRouter.navigate('playlists/'+plId, true);
      },
      render: function() {
         var modelJSON = this.model.toJSON();
         var playlists = _.map(modelJSON, function(pl){ 
            return {
               id: pl.id,
               title: pl.title
            }
         });
         var tmpHtml = this.template({
            playlists: playlists
         });
         
         $el = $(this.el);
         $el.html(tmpHtml);
         $el.trigger('create'); //jqueryMobile init
         
         //TODO navigate to playlist
         if(this.playlist){
            //render playlistview
         }
      }
   });
   var playlistsView = new PlaylistsView({
      model: playlistLibrary
   });
   
   
   //6.1-PlaylistView: View for a single playlist
   var PlaylistView = Backbone.View.extend({
      el: $("#mainView"),
      template: Handlebars.compile($("#playlist-template").html()),
      trackViews: {}, // maps track ID's to TrackView's
      
      render: function() {
         //1-container
         var tmpHtml = this.template();
         $el = $(this.el);
         $el.html(tmpHtml);
         
         //2-add single TrackViews
         var $plTracks = $("#playlistTracks");
         $plTracks.html(''); //empty
         (function(scope){
            var tracks = scope.model.get('tracks');
            _.each(tracks, function(trackId){
               var track = trackLibrary.get(trackId);
               var trackLi = $("<li class='track-li'></li>");
               $plTracks.append(trackLi);
               var trackView = new TrackView({
                  model:{
                     el: trackLi,
                     track: track,
                     parentView: scope
                  }
               });
               scope.trackViews[track.attributes.id] = trackView;
               trackView.render();
            });
         })(this);
      }
   });
   var playlistView;


   //-------------ROUTER
   var soundRouter = Backbone.Router.extend({
      routes: {
         ""                : "menu",
         "playlists/:id"   : "playlists",
         "search/:query"   : "search"
      },

      menu: function() {
         menuView.render();
         $("#pageTitle").text("");
      },
      search: function(query, page) {
         searchView.render();
         if(query!=searchView.query){
            searchView.searchTracks(query);
         }
         $("#pageTitle").text("Search");
      },
      playlists: function(id){
         if(id){
            playlistView =  new PlaylistView({
               model: playlistLibrary.get(id)
            });
            playlistView.render();
         }else{
            playlistsView.render();
         }
         $("#pageTitle").text("Playlists");
      }
   });
   appRouter = new soundRouter;


   //-----PAGE INIT
   $(document).ready(function(){
      //navigate to main page when closing dialog.
      //kind of a hack as jQuery mobile doesn't play nice with jquery routes
      $(document).delegate(".ui-dialog .ui-header>a", "click", function() {
         $.mobile.changePage($('#mainPage'),{
            changeHash: false,
            allowSamePageTransition: true,
            transition: 'none'
         });
      });
      
      trackLibrary.fetch(); //get data from localStorage
      playlistLibrary.fetch(); //get data from localStorage

      Backbone.history.start(); //starts the router
      
      var headerDiv = $("#mainHeader");
      
      function initView(){
         var headerTmpl = Handlebars.compile($("#header-template").html());
         headerDiv.html(headerTmpl());
         headerDiv.trigger('create');
         headerDiv.show();
         $("#disconnectBtn").live('click',function(){
            SC.disconnect();
            window.location.href='/';
         });
         $("#menuButton").live('click',function(){
            appRouter.navigate('',true);
         });
      }
      if(SC.isConnected()){
         initView();
      }else{
         headerDiv.hide();
         $("#connectBtn").live('click',function(){
            SC.connect(function(){
               initView();
               menuView.render();
            });
         });
      }
   })
});