(function(){
 
  return {
    PROJECT_TO_USE: '1',
    TRACKERS: [],
    PROJECTS: [],
    appID:  'RedmineAPP_IntegrationV1',
    //defaultState: 'loading',
    requests: {
      getAudit: function(id)
      {
        return {
          url: '/api/v2/tickets/'+id+'/audits.json',
          type: 'GET',
          contentType: 'application/json',
          dataType: 'json',
          proxy_v2: true
        };
      },
      updateTicket: function(id, data)
      {
        return {
          url: '/api/v2/tickets/'+id+'.json',
          type: 'PUT',
          data: data,
          dataType: 'json',
          contentType: 'application/json',
          proxy_v2: true
        };
      },
      postRedmine: function( project, apiKey, redmine_url, data)
      {
        return {
          url: redmine_url+'/issues.json?key='+apiKey,
          type: 'POST',
          username: apiKey,
          password: 'anything',
          dataType: 'json',
          data: data,
          proxy_v2: true
        };
      },
      getProjects: function(redmine_url, apiKey){
        return {
          url: redmine_url+'/projects.json?key='+apiKey,
          type:'GET',
          dataType: 'json',
          proxy_v2: true
        };
      },
      getTrackers: function(redmine_url, apiKey)
      {
        return {
          url: redmine_url+'/projects/'+this.PROJECT_TO_USE+'.json?key='+apiKey+'&include=trackers',
          type: 'GET',
          dataType: 'json',
          proxy_v2: true
        };
      }
   },
    events: {
      'app.activated': 'onActivated',
      'postRedmine.done': 'fn_result',
      'click #submitToRedmine': 'fn_prep_to_post',
      'getProjects.done': 'fn_listProjects',
      'getTrackers.done': 'fn_saveTrackers',
      'getAudit.done': 'fn_listMeta',
      'click .project': 'fn_projectSelect'
    },
    fn_renderError: function(error_text)
    {
      services.notify(error_text, 'error');
      this.switchTo('error', {error: error_text});
    },
    onActivated: function(){
      console.log('app: 1.0');
      this.doneLoading = false;
      this.loadIfDataReady();
    },
    loadIfDataReady: function(){
      if ( !this.doneLoading && this.ticket().status() != null && this.ticket().requester().id()) {
        this.doneLoading = true;
        if(this.settings.redmine_url.search('\/$') != -1){
          this.fn_renderError('Your Redmine URL has a "/" at the end. Remove it and try again.', 'error');
        }else{
          this.ajax('getProjects', this.settings.redmine_url, this.settings.apiKey);
        }
      }
    },
    fn_result: function(result){
      services.notify(this.I18n.t('issue.posted'));
      /*var xml = this.$(result);
      var id = xml.find("id");
      id = id.text();
      */

      id = result.issue.id
      
      var data = {"ticket":{"comment":{"public":false, "value":"This ticket was pushed to Redmine\n\n"+this.settings.redmine_url+"/issues/"+id+"\n\n"}, "metadata":{"pushed_to_redmine":true, "redmine_id": id}}};
      data = JSON.stringify(data);
      this.ajax('updateTicket', this.ticket().id(), data);
    },
    fn_listProjects: function(data)
    {
      if(data == null){
        this.fn_renderError("No data returned. Please check your API key.");
      }else{
        this.PROJECTS = data;
        //this.ajax('getAudit', this.ticket().id());
        this.switchTo('projectList', {project_data: data});
        this.ajax('getAudit', this.ticket().id());
        //this.ajax('getTrackers', this.settings.redmine_url, this.settings.apiKey);
      }
    },
    fn_prep_to_post: function(){
      var subject = this.$('#rm_subject').val();
      var tracker = this.$('#rm_tracker').val();
      var priority = this.$('#rm_priority').val();
      if(subject.length < 1){
        services.notify('You must include a subject.', 'error');
      }else{
        var ticket_desc = this.ticket().description();
        //ticket_desc = ticket_desc.replace( /&/gim, ' &amp; ' ).replace( /</gim, ' &lt; ').replace( />/gim, ' &gt; ').replace(/:/gim, '');
        ticket_desc = ticket_desc.replace( /&/gim, '' ).replace( /</gim, '').replace( />/gim, '').replace(/:/gim, '');
        var data = {"issue": {"subject": subject, "project_id": this.PROJECT_TO_USE, "tracker_id": tracker, "description": "This issue was pushed from Zendesk to Redmine.\n---\n\nDescription:\n"+ticket_desc+"\n---\n\nAdditional Message from Zendesk\n---\n"+this.$('#rm_note').val()+"\n\nTicket URL: https://"+this.currentAccount().subdomain()+".zendesk.com/tickets/"+this.ticket().id()+"\n\n"}}
        //var data = '<issue><subject>'+subject+'</subject><project_id>'+this.PROJECT_TO_USE+'</project_id><tracker_id>'+tracker+'</tracker_id><description>This issue was pushed from Zendesk to Redmine.\n---\n\nDescription:\n'+ticket_desc+'\n---\n\nAdditional Message from Zendesk\n---\n'+this.$('#rm_note').val()+'\n\nTicket URL: https://'+this.currentAccount().subdomain()+'.zendesk.com/tickets/'+this.ticket().id()+'\n\n</description></issue>';
        this.ajax('postRedmine', this.settings.project, this.settings.apiKey, this.settings.redmine_url, data);
      }
    },
    fn_projectSelect: function(e)
    {
      this.PROJECT_TO_USE = e.target.id;
      this.ajax('getTrackers', this.settings.redmine_url, this.settings.apiKey);
      //this.switchTo('index', {track: this.TRACKERS});
    },
    fn_saveTrackers: function(data)
    {
      this.TRACKERS = data.project;
      this.switchTo('index', {track: this.TRACKERS});
      //this.ajax('getAudit', this.ticket().id());
    },
    fn_listMeta: function(data)
    {
      var pushed_to_redmine = false;
      var redmine_id = 0;
      var redmine = false;
      var html = "<p></p>";
      for(var i=0; i<=data.count; i++)
      {
        try{
          pushed_to_redmine = data.audits[i].metadata.custom.pushed_to_redmine;
          if(pushed_to_redmine){
            redmine=true;
            redmine_id = data.audits[i].metadata.custom.redmine_id;
            html += '<p><a href="'+this.settings.redmine_url+'/issues/'+redmine_id+'">Issue '+redmine_id+'</a></p>';
          }else{
          }
        }catch(err){
        }
      }
      if(redmine){
        this.switchTo('projectList', {project_data: this.PROJECTS});
        this.$('#issues_list').html("<p><h3>Linked Issues:</h3></p>"+html);
      }else{
        this.switchTo('projectList', {project_data: this.PROJECTS});
      }
    }
  };
}());
