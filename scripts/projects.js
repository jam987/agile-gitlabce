var projects = (function () {

  async function getProjectList(incomingURL) {
    let url, projectPages, dropdown;

    projectList = [];
    url = incomingURL + "projects?order_by=name&sort=asc&simple=true&private_token=" + gitlabKey;

    // Get number of project pages
    projectPages = getHeaderValue(url, "x-total-pages");

    // Set up drowndown
    dropdown = $("#project-dropdown");
    dropdown.empty();
    dropdown.append("<option selected='true' disabled>Choose Project</option>");
    dropdown.prop("selectedIndex", 0);

    // Fill dropdown
    console.log("Obtaining data at: " + url + "&page=1 of " + projectPages + " page(s)");

    for (let i = 1; i <= projectPages; i += 1) {
      await $.getJSON(url + "&page=" + i, function (data) {
        // TODO Alphabetize project list THEN make option list
        projectList = projectList.concat(data);
        $.each(data, function (key, entry) {
          let projName;

          if (currUserName === null || currUserName.length === 0) {
            projName = entry.name + " (" + entry.namespace.path + ")";
          } else {
            projName = entry.name;
          }
          dropdown.append($("<option></option>").attr("value", entry.id).text(projName));
        });
      });
    }

  }

  async function getProjects(projFilter) {
    setPhase("project_start");

    // Get and set variables
    baseURL = document.getElementById("base_url").value;
    gitlabKey = document.getElementById("gitlab_key").value;

    // Set or clear username
    await updateCurrUserName();
    let url;

    // Build URL and get project list
    if (projFilter === "all" || currUserName === null) {
      url = baseURL;
    } else {
      url = baseURL + "users/" + currUserName + "/";
    }

    await getProjectList(url);

    $("#btnGetIssues").prop("disabled", true);
    setPhase("project_end");
  }

  return {
    getProjects: async function(projFilter) {
      await getProjects(projFilter);
    }
  };

})();