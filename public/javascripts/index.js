// Load the application once the DOM is ready, using `jQuery.ready`:
$(function(){
   
   ////////models
   
   //track
   var Track = Backbone.Model.extend({
     // Default attributes for a todo item.
     defaults: function() {
       return {};
     },
     
     isStreamable: function(){
        return this.attributes.streamable;
     }
   });
   
   var TrackCollection = Backbone.Collection.extend({
      // Reference to this collection's model.
      model: Track,

      nextOrder: function() {
         if (!this.length) return 1;
         return this.last().get('order') + 1;
      },

      // Todos are sorted by their original insertion order.
      comparator: function(todo) {
         return todo.get('order');
      }
   });

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
      rendered: false,
      
      events: {
         //"keypress #searchInput"    : "searchTracks",
         "change #searchInput"    : "launchSearch"
      },
      
      launchSearch: function(e){
         var query = e.currentTarget.value;
         appRouter.navigate('search/'+query, true);
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
                  var resTracks = new TrackCollection; //TODO store this in view?
                  resTracks.add(res);
                  var resTracksView = new SearchResultsView({
                     model: resTracks
                  });
                  resTracksView.render();
               }
            })
         //}
                  
      },

      
      wasRendered: function(){
         return this.rendered;
      },

      render: function() {
         var tmpHtml     = this.template();
         $el = $(this.el);
         $el.html(tmpHtml);
         //jqueryMobile init
         $el.trigger('create'); //FIXME refactor decoration
      },

      initialize: function(){

      }
   });
   
   var searchView = new SearchView;
   
   //2.1-SearchResultsView
   var SearchResultsView = Backbone.View.extend({
      el: null, //must be set at init time
      
      initialize: function(){
         this.el = $("#searchResults");
      },
      
      render: function() {
         var $el = $(this.el);
         $el.html(''); //empty results
         
         //add single TrackViews
         this.model.each(function(element, index, list){
            var trackLi = $("<li class='track-li' data-role='controlgroup' data-type='horizontal'></li>");
            $el.append(trackLi);
            var trackView = new TrackView({
               model:{
                  el: trackLi,
                  track: element
               }
            });
            trackView.render();
         })
         $el.trigger('create'); //jqueryMobile init
         this.wasRendered = true;
      }
   });

   //2.1.1-TrackView
   var TrackView = Backbone.View.extend({
      el: null, //must be set at init time
      template: Handlebars.compile($("#track-template").html()),

      events: {
         //"click .play-button"  : 'togglePlay',
         "click .ui-icon-play" : 'togglePlay',
         "click .ui-icon-pause" : 'togglePlay',
         "click .track-details" : 'showTrackOptions'
      },
      
      togglePlay: function(){
         if(!this.model.track.isStreamable()){
            return;
         }
         var trackId = this.model.track.id;
         
         var buttonDiv = $(this.el).find('.play-button div');
         //var soundObj;
         if(buttonDiv.hasClass('ui-icon-play')){
            buttonDiv.removeClass('ui-icon-play');
            buttonDiv.addClass('ui-icon-pause');
            //need to wrap the view in a closure here
            (function(cScope){
               var scope = cScope;
               SC.whenStreamingReady(function(){
                  if(!scope.soundObj){
                     scope.soundObj = SC.stream(trackId);
                  }
                  scope.soundObj.play();
               });
            })(this);
         }else{
            buttonDiv.removeClass('ui-icon-pause');
            buttonDiv.addClass('ui-icon-play');
            this.soundObj.pause();
         }
         
      },
      
      showTrackOptions: function(){
         //$.mobile.changePage($('#trackOptionsDialog'), 'pop', true, true);
         $.mobile.changePage($('#trackOptionsDialog'),{
            role: 'dialog',
            changeHash: false,
            allowSamePageTransition: true
//            pageContainer: $('#mainView')
         });
      },
      
      initialize: function(){
         this.el = this.model.el;
         this.delegateEvents(this.events);
      },
      
      render: function() {
         var tmpHtml     = this.template(this.model.track.toJSON());
         $el = $(this.el);
         $el.html(tmpHtml);
         //jqueryMobile init
         $el.trigger('create'); //FIXME refactor decoration. //FIXME is it even necessary here>
      }
   });









   // The DOM element for a todo item...
   window.PlaylistView = Backbone.View.extend({

      //... is a list tag.
      tagName:  "li",

      // Cache the template function for a single item.
      template: Handlebars.compile($('#track-template').html()),

      // The DOM events specific to an item.

      // The TodoView listens for changes to its model, re-rendering.
      initialize: function() {
         $el = $(this.el);
         
         $el.attr({
            class: "track-li",
            'data-role': "controlgroup",
            'data-type': "horizontal"
         });
         // this.model.bind('change', this.render, this);
         // this.model.bind('destroy', this.remove, this);
      },
      
      // Re-render the contents of the todo item.
      render: function() {
         $(this.el).html(this.template(this.model.toJSON()));
         //this.setText(); ??
         return this;
      },

      // To avoid XSS (not that it would be harmful in this particular app),
      // we use `jQuery.text` to set the contents of the todo item.
      setText: function() {
         var text = this.model.get('text');
         this.$('.todo-text').text(text);
         this.input = this.$('.todo-input');
         this.input.bind('blur', _.bind(this.close, this)).val(text);
      },

      // Close the `"editing"` mode, saving changes to the todo.
      close: function() {
         this.model.save({text: this.input.val()});
         $(this.el).removeClass("editing");
      },

      // If you hit `enter`, we're through editing the item.
      updateOnEnter: function(e) {
         if (e.keyCode == 13) this.close();
      },

      // Remove this view from the DOM.
      remove: function() {
         $(this.el).remove();
      },

      // Remove the item, destroy the model.
      clear: function() {
         this.model.destroy();
      }

   });



   //router
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
         if(!searchView.wasRendered()){
            searchView.render();
         }
         if(query){
            searchView.searchTracks(query);
         }
      }
   });

   appRouter = new soundRouter;
   Backbone.history.start();


   $(document).ready(function(){
      //FIXME fix this
      $(document).delegate(".ui-dialog .ui-header>a", "click", function() {
         $.mobile.changePage($('#mainPage'),{
            role: 'dialog',
            changeHash: false,
            allowSamePageTransition: true,
            transition: 'none'
         });
      });
      
      function getUserDetails(){
         SC.get("/me", function(me){
            $("#avatarDiv>img").attr('src', me.avatar_url)
         });
      }

      $("#connectBtn").live('click',function(){
         SC.connect(function(){
            indexView.render();
         });
      });

      $("#disconnectBtn").live('click',function(){
         SC.disconnect();
         indexView.render();
      });


      $(".ui-icon-play").live('mousedown', function(evt){
         //evt.preventDefault();
         evt.stopPropagation();
      })
   })







});
