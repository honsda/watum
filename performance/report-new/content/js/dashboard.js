/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 100.0, "KoPercent": 0.0};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8614961496149615, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [1.0, 500, 1500, "Get Courses After Temp Update A"], "isController": false}, {"data": [1.0, 500, 1500, "Update Course Temp B"], "isController": false}, {"data": [1.0, 500, 1500, "Get Courses After Temp Update B"], "isController": false}, {"data": [1.0, 500, 1500, "Update Course Temp C"], "isController": false}, {"data": [0.9991666666666666, 500, 1500, "Get Students"], "isController": false}, {"data": [1.0, 500, 1500, "Get Courses After Temp Update C"], "isController": false}, {"data": [0.965, 500, 1500, "Login User"], "isController": false}, {"data": [0.9991666666666666, 500, 1500, "Refresh Access Token"], "isController": false}, {"data": [0.9983333333333333, 500, 1500, "Get Current User"], "isController": false}, {"data": [1.0, 500, 1500, "Restore Course C"], "isController": false}, {"data": [1.0, 500, 1500, "Update Course Temp A"], "isController": false}, {"data": [0.5, 500, 1500, "Get Grades"], "isController": false}, {"data": [0.4708333333333333, 500, 1500, "User Operation Flow"], "isController": true}, {"data": [0.9966666666666667, 500, 1500, "Get Courses"], "isController": false}, {"data": [1.0, 500, 1500, "Temporary Write Cycle C"], "isController": true}, {"data": [1.0, 500, 1500, "Login Admin User"], "isController": false}, {"data": [1.0, 500, 1500, "Temporary Write Cycle B"], "isController": true}, {"data": [1.0, 500, 1500, "Temporary Write Cycle A"], "isController": true}, {"data": [1.0, 500, 1500, "Restore Course B"], "isController": false}, {"data": [1.0, 500, 1500, "Restore Course A"], "isController": false}, {"data": [0.9983333333333333, 500, 1500, "Get Enrollments"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 3909, 0, 0.0, 205.25888974162166, 33, 1632, 46.0, 909.0, 955.0, 1132.9, 12.220245780435727, 29.79672220785047, 11.073764293490663], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["Get Courses After Temp Update A", 12, 0, 0.0, 40.75, 36, 50, 40.0, 48.800000000000004, 50.0, 50.0, 0.05928385107896609, 0.011926243478776381, 0.0389050272705715], "isController": false}, {"data": ["Update Course Temp B", 12, 0, 0.0, 41.66666666666667, 36, 52, 40.0, 50.800000000000004, 52.0, 52.0, 0.059284436847253645, 0.027731684814291502, 0.047242285612655255], "isController": false}, {"data": ["Get Courses After Temp Update B", 12, 0, 0.0, 40.833333333333336, 35, 46, 42.0, 45.7, 46.0, 46.0, 0.059287658779761165, 0.011927009481084766, 0.03890752607421827], "isController": false}, {"data": ["Update Course Temp C", 12, 0, 0.0, 40.66666666666666, 36, 45, 39.0, 45.0, 45.0, 45.0, 0.05928795170008201, 0.027559633798085, 0.04707139134000653], "isController": false}, {"data": ["Get Students", 600, 0, 0.0, 50.67333333333334, 33, 540, 43.0, 48.0, 54.0, 298.98, 1.9228612174916275, 0.38119221401445347, 1.7594931257711472], "isController": false}, {"data": ["Get Courses After Temp Update C", 12, 0, 0.0, 41.66666666666666, 37, 50, 41.5, 48.2, 50.0, 50.0, 0.05928795170008201, 0.011927068408414938, 0.03890771830317882], "isController": false}, {"data": ["Login User", 200, 0, 0.0, 260.50999999999993, 171, 1632, 208.5, 238.9, 619.5499999999993, 1307.9, 0.6700908308121166, 0.8605170337089193, 0.49209795387764815], "isController": false}, {"data": ["Refresh Access Token", 600, 0, 0.0, 51.17999999999999, 35, 541, 45.0, 51.0, 54.0, 299.0, 1.9229105173590748, 2.3047040250122586, 1.8196291907431088], "isController": false}, {"data": ["Get Current User", 600, 0, 0.0, 51.47333333333332, 33, 1038, 44.0, 49.0, 55.0, 298.0, 1.9229536568168706, 0.7235770393324147, 1.7633334802256266], "isController": false}, {"data": ["Restore Course C", 12, 0, 0.0, 48.58333333333333, 35, 137, 40.5, 110.3000000000001, 137.0, 137.0, 0.05928824462329732, 0.026922884521321532, 0.04701372522863029], "isController": false}, {"data": ["Update Course Temp A", 12, 0, 0.0, 43.33333333333333, 36, 55, 43.0, 53.800000000000004, 55.0, 55.0, 0.059284436847253645, 0.028426424308595256, 0.047937025106959005], "isController": false}, {"data": ["Get Grades", 600, 0, 0.0, 964.7650000000001, 877, 1439, 923.0, 1109.9, 1137.9499999999998, 1327.95, 1.917582312220752, 1.1659237533317992, 1.750917443287503], "isController": false}, {"data": ["User Operation Flow", 600, 0, 0.0, 1191.0149999999994, 1022, 2197, 1126.0, 1385.9, 1555.85, 1844.8400000000001, 1.9164124758452177, 27.192040250650784, 8.769832872862002], "isController": true}, {"data": ["Get Courses", 600, 0, 0.0, 70.19833333333322, 34, 989, 47.0, 98.0, 149.49999999999932, 420.73000000000025, 1.9228119201520302, 22.06351568533824, 1.757570270763965], "isController": false}, {"data": ["Temporary Write Cycle C", 12, 0, 0.0, 130.91666666666666, 113, 212, 124.0, 190.4000000000001, 212.0, 212.0, 0.05926277112717791, 0.06638124851843072, 0.1329361184366481], "isController": true}, {"data": ["Login Admin User", 1, 0, 0.0, 215.0, 215, 215, 215.0, 215.0, 215.0, 215.0, 4.651162790697675, 5.645893895348837, 3.3748183139534884], "isController": false}, {"data": ["Temporary Write Cycle B", 12, 0, 0.0, 130.5, 113, 195, 125.0, 179.40000000000006, 195.0, 195.0, 0.05925838135731322, 0.06672354854002163, 0.1332734885409105], "isController": true}, {"data": ["Temporary Write Cycle A", 12, 0, 0.0, 132.16666666666669, 111, 208, 130.5, 190.30000000000007, 208.0, 208.0, 0.05925808872911152, 0.06811208050211354, 0.13471956109508948], "isController": true}, {"data": ["Restore Course B", 12, 0, 0.0, 48.0, 38, 116, 41.5, 95.60000000000008, 116.0, 116.0, 0.05928707294780267, 0.02709604505817544, 0.047186488723104665], "isController": false}, {"data": ["Restore Course A", 12, 0, 0.0, 48.08333333333333, 34, 122, 41.0, 102.50000000000007, 122.0, 122.0, 0.059284436847253645, 0.02778957977215015, 0.047937025106959005], "isController": false}, {"data": ["Get Enrollments", 600, 0, 0.0, 53.90499999999997, 34, 863, 44.0, 50.0, 62.94999999999993, 334.0, 1.9228612174916275, 2.945592416515775, 1.7632487140865607], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": []}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 3909, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
