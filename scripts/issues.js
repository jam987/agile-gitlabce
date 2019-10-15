var issues = (function () {

  function enableIssueBtn() {
    $("#btnGetIssues").prop("disabled", false);
  }

  async function getIssuesList() {
    let url, projectPages, issue;

    // Get number of project pages
    url = baseURL + "projects/" + projectID + "/issues?private_token=" + gitlabKey;
    projectPages = getHeaderValue(url, "x-total-pages");

    // Get Data
    issueListArr = [];
    console.log("Obtaining data at: " + url + "&page=1 of " + projectPages + " page(s)");
    for (let i = 1; i <= projectPages; i += 1) {
      await $.getJSON(url + "&page=" + i, function(data) {
        issueListArr = issueListArr.concat(data);
      });
    }

    issueListJSON = {};
    for (let index in issueListArr) {
      if (issueListArr.hasOwnProperty(index)) {
        issue = issueListArr[index];
        issueListJSON[issue.iid] = issue;
        issueListJSON[issue.iid].issues = [];
      }
    }
  }

  async function getMilestoneList() {
    let url, projectPages, tempMilestoneList, milestone;

    // Get number of project pages
    url = baseURL + "projects/" + projectID + "/milestones?private_token=" + gitlabKey;
    projectPages = getHeaderValue(url, "x-total-pages");

    // Get Data
    tempMilestoneList = [];
    console.log("Obtaining data at: " + url + "&page=1 of " + projectPages + " page(s)");
    for (let i = 1; i <= projectPages; i += 1) {
      await $.getJSON(url + "&page=" + i, function(data) {
        tempMilestoneList = tempMilestoneList.concat(data);
      });
    }

    milestoneList = {};
    milestoneList["None"] = {issues: []};
    for (let index in tempMilestoneList) {
      if (tempMilestoneList.hasOwnProperty(index)) {
        milestone = tempMilestoneList[index];
        milestoneList[milestone.iid] = milestone;
        milestoneList[milestone.iid].issues = [];
      }
    }
  }

  async function loadIssueTable() {
    // Reset table
    $("#issuestable").dataTable().fnDestroy();
    $("#issuestablerows tr").remove();

    await getIssuesList();
    await getMilestoneList();

    $("#issuestable").DataTable({
      data: issueListArr,
      columns: [
        {data: "title"},
        {data: "state"},
        {data: "time_stats.human_time_estimate"}
      ],
      columnDefs: [{
        render: function ( data, type, row ) {
          return "<a href='" + row.web_url + "' target='_blank'>" + row.title + "</a>";
        },
        targets: 0
      }]
    });
  }

  async function getIssues() {
    setPhase("issue_start");

    // Get and set variables
    projectID = document.getElementById("project-dropdown").value;
    await updateProjectname();

    await loadIssueTable();
    setPhase("issue_end");

    await burndown.updateBurndownData();
  }

  return {
    getIssues: function() {
      getIssues();
    },

    enableIssueBtn: function() {
      enableIssueBtn();
    }
  };

})();
