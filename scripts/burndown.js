var burndown = (function () {

  let startHours, startDate, endDate, spentTimeList, idealEffort, remainEffort, issueNotesList, isLoaded;
  /* eslint-disable */
  const CONVERTTABLE = {
    mo: 160,
    w : 40,
    d : 8,
    h : 1,
    m : 1.0 / 60.0
  }
  const MSperDAY = (1000 * 60 * 60 * 24);
  const SECperHOUR = 3600
  const INVERSE = -1;
  const TWOdigitROUND = 100;
  const MSperMIN = (1000 * 60);
  /* eslint-enable */

  isLoaded = false;

  async function getIssueNotes(url) {
    let projectPages;

    // Get number of project pages
    projectPages = getHeaderValue(url, "x-total-pages");

    // Get Data
    // console.log("Obtaining data at: " + url + "&page=1 of " + projectPages + " page(s)");
    for (let i = 1; i <= projectPages; i += 1) {
      await $.getJSON(url + "&page=" + i, function(data) {
        issueNotesList = issueNotesList.concat(data);
      });
    }
  }

  function jsonToSeries(json, xlabel, ylabel, filter) {
    let filteredJSON, series, desiredIssues;

    // filter
    if (filter !== null) {
      // for each note, determine if it's from an issue of interest
      filteredJSON = json.filter(note => milestoneList[filter[1]].issues.includes(note.issue));
    }

    // Reduce json
    series = Object.values(filteredJSON.reduce((acc, cur) => {
        /* eslint-disable */
      acc[cur[xlabel]] = acc[cur[xlabel]] || {x: cur[xlabel], y : 0};
      acc[cur[xlabel]].y += +cur[ylabel];
        /* eslint-enable */

      return acc;
    }, {}));

    // Sort by x axis
    series = series.sort(function(first, second) {
      return parseFloat(first.x) - parseFloat(second.x);
    });

    return series;
  }

  function createMilestoneDD() {
    let dropdown, dropdownText;

    // Set up drowndown
    dropdown = $("#milestone-dropdown");
    dropdown.empty();
    dropdown.append("<option selected='true' disabled>Choose Milestone</option>");
    dropdown.prop("selectedIndex", 0);

    // Fill dropdown
    for (let milestone in milestoneList) { // iid
      if (milestoneList.hasOwnProperty(milestone)) {
        dropdownText = milestoneList[milestone].title;
        dropdownText += " (" + milestoneList[milestone].issues.length + " issues)";
        if (milestoneList[milestone].issues.length > 0) {
          dropdown.append($("<option></option>").attr("value", milestone).text(dropdownText));
        } else {
          dropdown.append($("<option disabled></option>").attr("value", milestone).text(dropdownText));
        }
      }
    }

    document.getElementById("milestone-dropdown").value = "All";

  }

  async function getNewData() {
    let issueIID, url, noteRE, body, match, time, spent, date;

    issueNotesList = [];
    startDate = issueListArr[0].created_at;
    endDate = issueListArr[0].updated_at;

    // Get data from issues
    for (let issue in issueListArr) {
      if (issueListArr.hasOwnProperty(issue)) {
        // Update dates
        if (startDate > issueListArr[issue].created_at) {startDate = issueListArr[issue].created_at;}
        if (endDate < issueListArr[issue].updated_at) {endDate = issueListArr[issue].updated_at;}

        // Get Notes
        issueIID = issueListArr[issue].iid;
        url = baseURL + "projects/" + projectID + "/issues/" + issueIID + "/notes";

        if (gitlabKey.length > 0) {
          url += "?&private_token=" + gitlabKey;
        }

        milestoneList["All"].issues.push(issueListArr[issue].iid);
        if (issueListArr[issue].milestone.iid) {
          milestoneList[issueListArr[issue].milestone.iid].issues.push(issueListArr[issue].iid);
        } else {
          milestoneList["None"].issues.push(issueListArr[issue].iid);
        }

        await getIssueNotes(url);
      }
    }

    startDate = new Date(startDate);
    endDate = new Date(endDate);

    for (let milestone in milestoneList) {
      if (milestoneList.hasOwnProperty(milestone)) {
        console.log(milestone);
        if (startDate > milestoneList[milestone].start_date) {startDate = milestoneList[milestone].start_date;}
        if (endDate < milestoneList[milestone].due_date) {endDate = milestoneList[milestone].due_date;}
      }
    }

    /* eslint-disable */
    milestoneList["None"].start_date = startDate;
    milestoneList["All"].start_date = startDate;
    milestoneList["None"].due_date = endDate;
    milestoneList["All"].due_date = endDate;
    /* eslint-enable */

    createMilestoneDD();

    // Go through notes to get changes in spend
    noteRE = /(added|subtracted) (.*) of time spent at (.*)-(.*)-(.*)/;
    spentTimeList = [];
    issueNotesList.forEach(function(note) {
      body = note.body;
      match = body.match(noteRE);

      // If time spent was changed
      if (match !== null) {
        // parse spent
        time = match[2].match(/([0-9]*)([a-zA-Z]*)/);
        spent = time[1] * CONVERTTABLE[time[2]];
        // update if subtracted
        if (match[1] === "subtracted") {spent *= INVERSE;}
        // parse date
        date = Date.UTC(parseInt(match[3], 10), parseInt(match[4], 10) - 1, parseInt(match[5], 10));
        spentTimeList.push({date: date, spent: spent, issue: note.noteable_iid, author: note.author.name});
      }
    });
  }

  function updateData(selectedMilestone) {
    let issueIID, dayDiff, idealDaily, day1, spentCummList, effort, effortDay, thisDay;

    startDate = milestoneList[selectedMilestone].start_date;
    endDate = milestoneList[selectedMilestone].due_date;

    startHours = 0;

    for (let issue in milestoneList[selectedMilestone].issues) {
      if (milestoneList[selectedMilestone].issues.hasOwnProperty(issue)) {
        issueIID = milestoneList[selectedMilestone].issues[issue];
        // Accumlate hours
        startHours += issueListJSON[issueIID].time_stats.time_estimate / SECperHOUR;
      }
    }

    // Create Cummulative lines
    dayDiff = Math.floor((endDate - startDate) / MSperDAY);
    idealDaily = startHours / dayDiff;

    idealEffort = [];
    remainEffort = [];
    day1 = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
    idealEffort.push([day1, startHours]);
    remainEffort.push([day1, startHours]);

    spentCummList = jsonToSeries(spentTimeList, "date", "spent", ["issue", selectedMilestone]);

    for (let i = 0; i <= dayDiff; i += 1) {
      effort = Math.max(0, Math.round((startHours - (idealDaily * i)) * TWOdigitROUND) / TWOdigitROUND);
      effortDay = day1 + (MSperDAY * i);
      idealEffort.push([effortDay, effort]);

      thisDay = spentCummList.filter(item => item.x === effortDay);
      if (thisDay.length === 0) {
        effort = remainEffort[i][1];
      } else {
        effort = remainEffort[i][1] - thisDay[0].y;
      }
      remainEffort.push([effortDay, effort]);
    }
    idealEffort.shift();
    remainEffort.shift();
  }

  async function updateBurndownData(selectedMilestone) {
    if (!isLoaded) {
      if (gitlabKey === "") {
        setPhase("burndown_end");
        document.getElementById("burndown-unavailable").style.display = "block";

        return;
      }
      setPhase("burndown_start");
      await getNewData();
      isLoaded = true;
    }

    updateData(selectedMilestone);

    $(function () {
      $("#burndown-chart").highcharts({
        title: {text: "Project Burndown Chart"},
        subtitle: {text: currProjectName + " - " + milestoneList[selectedMilestone].title},
        xAxis: {
          type: "datetime",
          title: {text: "Date"},
          // tickInterval: 86400000,
          labels: {
            format: "{value:%m/%d/%Y}",
            rotation: -30
          },
          plotLines: [{
            color: "#888888",
            width: 2,
            value: new Date(new Date().setHours(0, 0, 0, 0)).getTime() - (new Date()).getTimezoneOffset() * MSperMIN,
            dashStyle: "longdashdot"
          }]
        },
        yAxis: {
          title: {text: "Hours"}
        },
        tooltip: {
          valueSuffix: " hrs"
        },
        legend: {
          layout: "vertical",
          align: "right",
          verticalAlign: "middle",
          borderWidth: 1
        },
        series: [{
          type: "column",
          name: "Completed Tasks",
          color: "#4682b4",
          data: jsonToSeries(spentTimeList, "date", "spent", ["issue", selectedMilestone])
        }, {
          name: "Ideal Burndown",
          color: "rgba(255,0,0,0.75)",
          marker: {
            enabled: false
          },
          lineWidth: 2,
          data: idealEffort
        }, {
          type: "spline",
          name: "Remaining Effort",
          color: "rgba(0, 100, 0, 0.75)",
          marker: {
            radius: 6
          },
          lineWidth: 2,
          data: remainEffort
        }],
        exporting: {
          sourceWidth: 800,
          sourceHeight: 400
        },
        credits: {
          text: "Highcarts.com and lilyheart.github.io/agile-gitlabce",
          href: "https://lilyheart.github.io/agile-gitlabce/"
        },
        responsive: {
          rules: [{
            condition: {
              maxWidth: 500
            },
            chartOptions: {
              legend: {
                align: "center",
                verticalAlign: "bottom",
                layout: "vertical"
              }
            }
          }]
        }
      });
    });

    setPhase("burndown_end");
  }

  return {
    updateBurndownData: function(selectedMilestone) {
      updateBurndownData(selectedMilestone);
    }
  };

})();
