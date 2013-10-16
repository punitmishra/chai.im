define(['jquery', 'bootstrap', 'wysihtml5-rc', 'bootstrap-wysihtml5'], function($){
  var editor = {};
  var initIndexPage = function(){
    editor = $('#postContent').wysihtml5({
      "font-styles": true, 
      "emphasis": true, 
      "lists": true, 
      "html": false, 
      "link": true,   
      "image": true 
    });

    $('#postForm').submit(function(event){
      event.preventDefault();    

      var postContent = {
        'postKey' : $('#postId').val(),
        'postSubject' : $('#postSubject').val(),
        'postContent' : $('#postContent').val(),
        'postTags' : $('#postTags').val()
      };

      $.post('/admin/save/post', {'postContent' : postContent},function(response){
        if(response.retStatus === 'success'){
          $(location).attr('href', '/');
        }else{
        } 
      });
    });
  };


  var initPostsLink = function(){
    $("a.postLink").live("click", function(e){
      e.preventDefault();
      var postId = ($(this)[0]).getAttribute('id');

      $.get('/post/show/'+postId, function(response){
        if(response.retStatus === 'success'){
          var postData = response.postData;
          $('#postId').val(postData.key);
          $('#postSubject').val(postData.subject);
          var editorInstance = editor.data('wysihtml5').editor;
          editorInstance.setValue(postData.content, true);
          $('#postTags').val(postData.tags);
        }else if(response.retStatus === 'failure'){

        }
      });  
    });
  };

  var initPostsDeleteLink = function(){
    $("a.postDelete").live('click', function(e){
      e.preventDefault();
      var postId = ($(this)[0]).getAttribute('id');
      //TODO: show a prompt before deleting

      data = {
        'post_id' : postId,
      };
      $.ajax({
        url : '/post/delete/',
        type : 'POST',
        dataType : 'json',
        data : data,
        success : function(response, textStatus, jqxhr){
          if(response.retStatus === 'success'){
            $(location).attr('href', '/admin');
          }else{
            console.log('error while deleting post');
          }
        },
        error : function(errorStatus){

        }
      });
    });

  };

  return function(){
    initIndexPage();
    initPostsLink();
    initPostsDeleteLink();
  };
});
