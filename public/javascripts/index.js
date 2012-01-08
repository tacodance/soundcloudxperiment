// Load the application once the DOM is ready, using `jQuery.ready`:
$(function(){
   
   //----------------MODELS
   //track
   var Track = Backbone.Model.extend({
    //localStorage: new Store("tracks"),
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
           // if(!this.get('tags')){
           //    this.set({
           //       tags: []
           //    }); //FIXME read/parse from metadata  
           // }           
        }
        this.bind('tagsChanged', this.syncTrack, this);
     },
     syncTrack: function(){
        window.trackLibrary.syncTrack(this);
     },
     defaults: function() {
       return {};
     }
   });
   
   var TrackCollection = Backbone.Collection.extend({
      model: Track,

      nextOrder: function() {
         if (!this.length) return 1;
         return this.last().get('order') + 1;
      },

      comparator: function(todo) {
         return todo.get('order');
      }
   });

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
   
   var Playlist = Backbone.Model.extend({
     
     addTrack: function(track){
        var tracks = this.get('tracks');
        if(!tracks.get(track.get('id'))){ //track not already there... no duplicates!
           tracks.add(track);
        }
     },
     
     initialize: function(obj){
        this.set(obj);
        this.set({
           tracks: new TrackCollection
        });
     }
   });

   var PlaylistLibrary = Backbone.Collection.extend({
     model: Playlist,
     localStorage: new Store("playlistLibrary")
   });
      
   window.trackLibrary = new TrackLibrary;
   window.playlistLibrary = new PlaylistLibrary;

   //--------------VIEWS
   //1-Appview
   var AppView = Backbone.View.extend({
      el: $("#mainView"),

      template: Handlebars.compile($("#index-template").html()),
      
      render: function() {
         var tmpHtml     = this.template({
            isConnected: SC.isConnected()
         });
         $el = $(this.el);
         $el.html(tmpHtml);
         //jqueryMobile init
         $el.trigger('create'); //FIXME refactor decoration
      }
   });
   
   var indexView = new AppView; //can be cached here


   //2-SearchView
   var SearchView = Backbone.View.extend({
      el: $("#mainView"),
      template: Handlebars.compile($("#search-template").html()),
      footerTemplate: Handlebars.compile($("#searchFooter-template").html()),
      footerView: null,
      footerDiv: $("#mainFooter"), //FIXME remove this
      query: null,
      resTracksView: null,
      
      events: {
         //"keypress #searchInput"    : "searchTracks",
         "change #searchInput"    : "launchSearch"
      },
      
      launchSearch: function(e){
         var query = e.currentTarget.value;
         appRouter.navigate('search/'+query, true);
      },
      
      getSelectedTrack: function(){
         return this.resTracksView.getSelectedTrack();
      },
      
      searchTracks: function(query){
         //if (e.keyCode == 13){
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
                  
                  if(!this.footerView){
                     var footerView = new SearchFooterView({
                        model: resTracks
                     });
                  }
                  
                  searchView.query = query;
                  
                  //resTracks.bind('change', searchView.refreshFooter, searchView);
               }
            })
         //}
                  
      },
      
      render: function() {
         var tmpHtml     = this.template();
         $el = $(this.el);
         $el.html(tmpHtml);
         //jqueryMobile init
         $el.trigger('create'); //FIXME refactor decoration
         if(this.query){ //TODO check
            this.resTracksView.render();
         }
         
      },

      initialize: function(){
         //this.model.bind('change', this.render, this);
      },
      
      refreshFooter: function(track){
         var footer = this.footerDiv;
         footer.html(this.footerTemplate(track.toJSON()));
         footer.trigger('create');
         footer.show();
      }
   });
   
   var searchView = new SearchView;
   window.sv = searchView;// FIXMe debug only
   
   //2.1-SearchResultsView
   var SearchResultsView = Backbone.View.extend({
      //el: null, //must be set dynamically
      trackViews: {}, // {trackid: trackview, ...
      
      initialize: function(){
         //this.el = $("#searchResults");
      },
      
      refreshTrackView: function(trackId){
         var track = this.model.get(trackId);
         
      },
      
      getSelectedTrack: function(){
         return this.model.selectedTrack;
      },
      
      setSelectedTrack: function(trackId){
         if(this.model.selectedTrack){
            this.model.selectedTrack.set({
               selected: false
            });
         }
         var selectedTrack = this.model.get(trackId);
         this.model.selectedTrack = selectedTrack;
         selectedTrack.set({
            selected: true
         });
         selectedTrack.trigger('selected',selectedTrack);
      },
      
      render: function() {
         //var $el = $(this.el);
         var $el = $("#searchResults");
         $el.html(''); //empty results
         
         //add single TrackViews
         (function(scope){
            //var vScope = scope;
            scope.model.each(function(element, index, list){
               var trackLi = $("<li class='track-li'></li>");
               $el.append(trackLi);
               var trackView = new TrackView({
                  model:{
                     el: trackLi,
                     track: element,
                     parentView: scope,
                     selected: scope.model.selectedTrack == element.id
                  }
               });
               scope.trackViews[element.attributes.id] = trackView;
               trackView.render();
            })
         })(this);
         $el.trigger('create'); //jqueryMobile init
      }
   });

   //2.1.1-TrackView
   var TrackView = Backbone.View.extend({
      el: null, //must be set at init time
      template: Handlebars.compile($("#track-template").html()),

      events: {
         //"click .play-button"  : 'togglePlay',
         "click .ui-icon-play"  : 'togglePlay',
         "click .ui-icon-pause" : 'togglePlay',
         "click .track-entry"                : 'selectTrack',
      },
      
      selectTrack: function(e){
         this.model.parentView.setSelectedTrack(this.model.track.id);
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
      },
      
      render: function() {
         var tmpHtml     = this.template(this.model.track.toJSON());
         $el = $(this.el);
         $el.html(tmpHtml);
         //jqueryMobile init
         $el.trigger('create'); //FIXME refactor decoration. //FIXME is it even necessary here?
      }
   });
   
   //3-SearchFooter
   var SearchFooterView = Backbone.View.extend({
      el: $("#mainFooter"),
      template: Handlebars.compile($("#searchFooter-template").html()),
      
      events:{
         "click #addTrack" : "addTrack",
         "click #tagTrack" : "tagTrack"
      },
      
      addTrack: function(e){
         var selTrack = searchView.getSelectedTrack();
         this.addToPlaylistView = new AddToPlaylistView({ //FIXME could be singleton
            model: playlistLibrary
         });
         this.addToPlaylistView.render();
         this.addToPlaylistView.trigger('create');
         $.mobile.changePage($('#addToPlaylistDialog'),{
            role: 'dialog',
            changeHash: false,
            allowSamePageTransition: true
         });
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
         this.model.bind('selected', this.refresh, this);
         this.render();
         $(this.el).hide();
      },
      
      //TODO could be done better?
      refresh: function(track,b,c){
         if(track.get('selected')){
            $(this.el).show();
         }
      },
      
      render: function() {
         var tmpHtml     = this.template();
         $el = $(this.el);
         $el.html(tmpHtml);
         $el.trigger('create');
      }
   });
   
   //4----trackTags
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
         // this.render();
         // $(this.el).hide();
         
      },
            
      render: function() {
         //var selTrack = searchView.getSelectedTrack(); //FIXME should be done better
         var selTrack = this.model.track;
         var libTrack = trackLibrary.get(selTrack.get('id')) || selTrack;
         
         var tmpHtml     = this.template({
            tags: libTrack.get('tags'),
            track: libTrack.toJSON()
         }); //TODO use model
         $el = $(this.el);
         $el.html(tmpHtml);
         setTimeout(function(){
            $el.trigger('create');            
         });

      }
   });
   
   //5---------addToPlaylist
   var AddToPlaylistView = Backbone.View.extend({
      el: $("#addToPlaylistDiv"),
      template: Handlebars.compile($("#addToPlaylist-template").html()),
      
      events:{
         "keypress #newPlaylist" : "addPlaylist",
         "click .playlistEntry" : "addToPlaylist"
      },
      
      addPlaylist: function(e){
         if(e.keyCode==13){
            var title = e.currentTarget.value;
            var playlist = playlistLibrary.get({title: title});
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
         var playlists   =  _.map(modelJSON, function(pl){ 
            return {
               id: pl.id,
               title: pl.title
            }
         });
         var tmpHtml     = this.template({
            playlists: playlists
         });
         $el = $(this.el);
         $el.html(tmpHtml);
         setTimeout(function(){
            $el.trigger('create');            
         });

      }
   });
   




   //-------------ROUTER
   var soundRouter = Backbone.Router.extend({
      routes: {
         "":                 "index",    // #index
         "search/:query":        "search",  // #search/kiwis
         // "search/:query/p:page": "search"   // #search/kiwis/p7
      },

      index: function() {
         indexView.render(); //FIXME do we need a view?
      },

      search: function(query, page) {
         //if(!searchView.wasRendered()){
         // if(!searchView.query){
            searchView.render();
         // }
         if(query!=searchView.query){
            searchView.searchTracks(query);
         }
      }
   });

   appRouter = new soundRouter;
   Backbone.history.start();



   //-------------INIT
   $(document).ready(function(){
      //FIXME fix this
      $(document).delegate(".ui-dialog .ui-header>a", "click", function() {
         $.mobile.changePage($('#mainPage'),{
            // role: 'dialog',
            changeHash: false,
            allowSamePageTransition: true,
            transition: 'none'
         });
      });
      
      
      $("#mainFooter").hide(); //FIXME can be done better
      
      trackLibrary.fetch(); //get data from localStorage
      playlistLibrary.fetch(); //get data from localStorage
      
      var headerDiv = $("#mainHeader");
            
      function updateUserData(){
         SC.get("/me", function(me){
            var headerTmpl = Handlebars.compile($("#header-template").html());
            headerDiv.html(headerTmpl(me));
            headerDiv.trigger('create');
            headerDiv.show();
            //$("#avatarDiv>img").attr('src', me.avatar_url)
         });
      }
      if(SC.isConnected()){
         updateUserData();
      }else{
         headerDiv.hide();
      }
      
      //FIXME handle these better?
      $("#connectBtn").live('click',function(){
         SC.connect(function(){
            updateUserData();
            indexView.render();
         });
      });
      $("#disconnectBtn").live('click',function(){
         SC.disconnect();
         //indexView.render();
         window.location.href='/';
      });
      $(".ui-icon-play").live('mousedown', function(evt){
         //evt.preventDefault();
         evt.stopPropagation();
      })
   })







});
