(function () {
    var PROJECT_STATUS_ACTIVE = 1;
    return {
        PROJECT_TO_USE: 1,
        MEMBERS: [],
        TRACKERS: [],
        PROJECTS: [],
        appID: 'RedmineAPP_IntegrationV3',
        requests: {
            getAudit: function (id) {
                this.showSpinner(true);
                return {
                    url: '/api/v2/tickets/' + id + '/audits.json',
                    type: 'GET',
                    contentType: 'application/json',
                    dataType: 'json'
                };
            },
            updateTicket: function (id, data) {
                this.showSpinner(true);
                return {
                    url: '/api/v2/tickets/' + id + '.json',
                    type: 'PUT',
                    data: data,
                    dataType: 'json',
                    contentType: 'application/json'
                };
            },
            postRedmine: function (project, data) {
                this.showSpinner(true);
                return {
                    url: this.settings.redmine_url + '/issues.json?key={{setting.apiKey}}',
                    type: 'POST',
                    dataType: 'json',
                    data: data,
                    secure: true
                };
            },
            getProjects: function () {
                this.showSpinner(true);
                return {
                    url: this.settings.redmine_url + '/projects.json?key={{setting.apiKey}}&limit=100',
                    type: 'GET',
                    dataType: 'json',
                    secure: true
                };
            },
            getIssue: function (issue_id) {
                this.showSpinner(true);
                return {
                    url: this.settings.redmine_url + '/issues/' + issue_id + '.json?key={{setting.apiKey}}',
                    type: 'GET',
                    dataType: 'json',
                    secure: true
                };
            },
            getTrackers: function () {
                return {
                    url: this.settings.redmine_url + '/projects/' + this.PROJECT_TO_USE + '.json?key={{setting.apiKey}}&include=trackers',
                    type: 'GET',
                    dataType: 'json',
                    secure: true
                };
            },
            getMembers: function () {
                this.showSpinner(true);
                return {
                    url: this.settings.redmine_url + '/projects/' + this.PROJECT_TO_USE + '/memberships.json?key={{setting.apiKey}}',
                    type: 'GET',
                    dataType: 'json',
                    secure: true
                };
            }
        },
        events: {
            'app.activated': 'onActivated',
            'postRedmine.done': 'result',
            'click #submitToRedmine': 'prep_to_post',
            'getProjects.done': 'listProjects',
            'getAudit.done': 'listIssues',
            'click .js-project': 'projectSelect',
            'updateTicket.done': 'reset',
            'click .issue': 'get_issue',
            'click .back_button': 'onActivated',

            'click .nav-pills .js-projects': function () {
                this.setActivePill('js-projects');
                this.ajax('getProjects');
            },
            'click .nav-pills .js-issues': function () {
                this.setActivePill('js-issues');
                this.ajax('getAudit', this.ticket().id());
            }
        },
        setActivePill: function (itemClass) {
            this.$('.nav-pills li').removeClass('active');
            this.$('.nav-pills li.' + itemClass).addClass('active');
        },
        renderError: function (error_text) {
            services.notify(error_text, 'error');
            this.switchTo('error', {error: error_text});
        },
        onActivated: function () {
            console.log('ZDRedmine loaded');

            // Remove trailing slash from redmine_url
            if (this.settings.redmine_url.search('\/$') != -1) {
                this.settings.redmine_url = this.settings.redmine_url.slice(0, -1);
            }

            this.doneLoading = false;
            this.showSpinner(true);
            this.loadIfDataReady();
        },
        loadIfDataReady: function () {
            if (!this.doneLoading && this.ticket().status() != null && this.ticket().requester().id()) {
                this.doneLoading = true;
                this.ajax('getAudit', this.ticket().id());
            }
        },
        result: function (result) {
            services.notify(this.I18n.t('issue.posted'));
            var id = result.issue.id;
            var data = {
                "ticket": {
                    "comment": {
                        "public": false,
                        "value": this.I18n.t('issue.pushed') + "\n\n" + this.settings.redmine_url + "/issues/" + id + "\n\n"
                    }, "metadata": {"pushed_to_redmine": true, "redmine_id": id}
                }
            };
            data = JSON.stringify(data);
            this.ajax('updateTicket', this.ticket().id(), data);
        },
        listProjects: function (data) {
            if (data == null) {
                this.renderError("No data returned. Please check your API key.");
                return false;
            }

            // Only show active projects and sort by name
            data.projects = data.projects.filter(function (project) {
                return project.status === PROJECT_STATUS_ACTIVE;
            }).map(function (project) {
                // Prefix parent project's name
                if (project.hasOwnProperty('parent')) {
                    project.name = project.parent.name + ' - ' + project.name;
                }
                return project;
            }).sort(function (a, b) {
                if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
                if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
                return 0;
            });

            this.PROJECTS = data;

            this.setActivePill('js-projects');
            this.switchTo('projectList', {project_data: data});
            this.showSpinner(false);
        },
        prep_to_post: function () {

            this.showSpinner(true);

            var subject = this.$('#rm_subject').val();
            var tracker = this.$('#rm_tracker').val();
            var priority = this.$('#rm_priority').val();
            var asignee = this.$('#rm_assignee').val();
            if (subject.length < 1) {
                services.notify('You must include a subject.', 'error');
            } else {
                var data = {
                    "issue": {
                        "subject": subject,
                        "project_id": this.PROJECT_TO_USE,
                        "tracker_id": tracker,
                        "assigned_to_id": asignee,
                        "description": this.$('#rm_note').val() + "\n\nTicket URL: https://" + this.currentAccount().subdomain() + ".zendesk.com/tickets/" + this.ticket().id() + "\n\n"
                    }
                };
                this.ajax('postRedmine', this.settings.project, data);
            }
        },
        projectSelect: function (e) {

            this.showSpinner(true);

            this.PROJECT_TO_USE = e.target.id;
            var doneRequests = 0;
            this.ajax('getTrackers')
                .done(function (data) {
                    this.TRACKERS = data.project;
                }.bind(this))
                .always(function () {
                    doneRequests++;
                });

            this.ajax('getMembers')
                .done(function (data) {
                    var members = [];
                    data.memberships.forEach(function (membership) {
                        members.push(membership.user);
                    });
                    this.MEMBERS = members;
                }.bind(this))
                .always(function () {
                    doneRequests++;
                });

            // Wait for both requests to finish
            var interval = setInterval(function () {
                if (doneRequests == 2) {
                    clearInterval(interval);
                    this.showSpinner(false);
                    this.switchTo('newIssue', {trackers: this.TRACKERS, members: this.MEMBERS});
                }
            }.bind(this), 500);
        },
        listIssues: function (data) {
            var ticketHasIssue = false;
            var issueList = [];
            for (var i = 0; i <= data.count; i++) {
                try {
                    var redmine_meta = data.audits[i].metadata.custom;
                    if (redmine_meta.pushed_to_redmine) {
                        ticketHasIssue = true;
                        issueList.push(redmine_meta.redmine_id);
                    }
                } catch (err) {
                }
            }

            if ( ! ticketHasIssue) {
                // No issues available, so load project list
                this.ajax('getProjects');
                this.showIssueTab(false);
                return;
            }

            this.showIssueTab(true);

            var spawned = 0;
            var returned = 0;
            var issueDetails = [];
            issueList.forEach(function (issueId) {
                spawned++;

                this.ajax('getIssue', issueId)
                    .done(function (data) {
                        issueDetails.push(data.issue);
                    }.bind(this))
                    .always(function () {
                        returned++;
                    });
            }.bind(this));

            var interval = setInterval(function () {
                if (spawned == returned) {
                    clearTimeout(interval);

                    this.setActivePill('js-issues');
                    this.switchTo('issueList', {issues: issueDetails});
                    this.showSpinner(false);
                }
            }.bind(this), 500);

        },
        reset: function () {
            this.ajax('getAudit', this.ticket().id());
        },
        get_issue: function (e) {
            this.showSpinner(true);
            var issue_id = e.target.dataset.id;
            this.ajax('getIssue', issue_id)
                .done(function (data) {
                    this.show_issue(data);
                }.bind(this));
        },
        show_issue: function (data) {
            this.setActivePill('js-issues');
            this.showSpinner(false);
            this.switchTo('showIssue', {
                issue: data.issue,
                url: this.settings.redmine_url + "/issues/" + data.issue.id
            });
        },
        showSpinner: function(status) {
            if(status === true) {
                this.$('#spinner').show();
                this.$('#main').hide();
            } else {
                this.$('#spinner').hide();
                this.$('#main').show();
            }
        },
        showIssueTab: function(status) {
            if(status) {
                this.$('.js-issues').show();
            } else {
                this.$('.js-issues').hide();
            }
        }
    };
}());    