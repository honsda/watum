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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.8661166116611662, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [1.0, 500, 1500, "Get Courses After Temp Update A"], "isController": false}, {"data": [1.0, 500, 1500, "Update Course Temp B"], "isController": false}, {"data": [1.0, 500, 1500, "Get Courses After Temp Update B"], "isController": false}, {"data": [1.0, 500, 1500, "Update Course Temp C"], "isController": false}, {"data": [0.9991666666666666, 500, 1500, "Get Students"], "isController": false}, {"data": [1.0, 500, 1500, "Get Courses After Temp Update C"], "isController": false}, {"data": [0.99, 500, 1500, "Login User"], "isController": false}, {"data": [0.9983333333333333, 500, 1500, "Refresh Access Token"], "isController": false}, {"data": [0.9991666666666666, 500, 1500, "Get Current User"], "isController": false}, {"data": [1.0, 500, 1500, "Restore Course C"], "isController": false}, {"data": [1.0, 500, 1500, "Update Course Temp A"], "isController": false}, {"data": [0.5, 500, 1500, "Get Grades"], "isController": false}, {"data": [0.49416666666666664, 500, 1500, "User Operation Flow"], "isController": true}, {"data": [1.0, 500, 1500, "Get Courses"], "isController": false}, {"data": [1.0, 500, 1500, "Temporary Write Cycle C"], "isController": true}, {"data": [1.0, 500, 1500, "Login Admin User"], "isController": false}, {"data": [1.0, 500, 1500, "Temporary Write Cycle B"], "isController": true}, {"data": [1.0, 500, 1500, "Temporary Write Cycle A"], "isController": true}, {"data": [1.0, 500, 1500, "Restore Course B"], "isController": false}, {"data": [1.0, 500, 1500, "Restore Course A"], "isController": false}, {"data": [0.9983333333333333, 500, 1500, "Get Enrollments"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 3909, 0, 0.0, 191.70683039140454, 32, 3377, 40.0, 902.0, 932.0, 1093.9, 12.2112365868516, 29.738284361674708, 11.06560032624994], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["Get Courses After Temp Update A", 12, 0, 0.0, 35.916666666666664, 33, 40, 36.5, 39.400000000000006, 40.0, 40.0, 0.059396531242575434, 0.011948911558564979, 0.038978973627940124], "isController": false}, {"data": ["Update Course Temp B", 12, 0, 0.0, 38.5, 34, 49, 38.0, 46.60000000000001, 49.0, 49.0, 0.059393591431484545, 0.02778274442937607, 0.04732926817196424], "isController": false}, {"data": ["Get Courses After Temp Update B", 12, 0, 0.0, 36.083333333333336, 33, 48, 35.0, 45.000000000000014, 48.0, 48.0, 0.059393003504187206, 0.01194820187681891, 0.03897665854962285], "isController": false}, {"data": ["Update Course Temp C", 12, 0, 0.0, 37.08333333333333, 33, 43, 36.5, 42.1, 43.0, 43.0, 0.05939123979213066, 0.027607646622123234, 0.04715339643652561], "isController": false}, {"data": ["Get Students", 600, 0, 0.0, 42.52833333333332, 32, 602, 38.0, 50.89999999999998, 62.94999999999993, 77.0, 1.9204055896605363, 0.38070540498153205, 1.7572461303827367], "isController": false}, {"data": ["Get Courses After Temp Update C", 12, 0, 0.0, 38.25000000000001, 33, 69, 35.5, 60.00000000000003, 69.0, 69.0, 0.05939241558852935, 0.011948083604723677, 0.03897627272997239], "isController": false}, {"data": ["Login User", 200, 0, 0.0, 221.95, 176, 3377, 194.5, 232.9, 262.6499999999999, 707.1300000000017, 0.6697654481400613, 0.8600991838908014, 0.4918590009778575], "isController": false}, {"data": ["Refresh Access Token", 600, 0, 0.0, 45.71833333333335, 34, 637, 40.0, 52.0, 65.0, 291.0100000000018, 1.9204916458613404, 2.3017298678461686, 1.81734023910121], "isController": false}, {"data": ["Get Current User", 600, 0, 0.0, 41.7916666666667, 32, 598, 38.0, 49.0, 59.0, 74.98000000000002, 1.920528529451305, 0.7225894816253433, 1.7611096573777105], "isController": false}, {"data": ["Restore Course C", 12, 0, 0.0, 44.33333333333333, 33, 131, 36.0, 104.0000000000001, 131.0, 131.0, 0.059393591431484545, 0.026970722671523742, 0.04709726195543501], "isController": false}, {"data": ["Update Course Temp A", 12, 0, 0.0, 37.25, 33, 43, 36.5, 42.1, 43.0, 43.0, 0.05939535528321685, 0.02847960883208933, 0.048026713061038624], "isController": false}, {"data": ["Get Grades", 600, 0, 0.0, 945.8516666666661, 872, 1435, 912.0, 1084.9, 1097.9499999999998, 1176.7600000000002, 1.9148039878984386, 1.1637202537195066, 1.7483805944189845], "isController": false}, {"data": ["User Operation Flow", 600, 0, 0.0, 1121.7866666666662, 1015, 2331, 1078.0, 1262.0, 1295.0, 1629.1100000000008, 1.913741300451005, 27.116976016635196, 8.757609115149814], "isController": true}, {"data": ["Get Courses", 600, 0, 0.0, 45.28500000000001, 35, 405, 41.0, 55.0, 67.0, 91.97000000000003, 1.9204486167968837, 22.036397702503304, 1.7554100637909014], "isController": false}, {"data": ["Temporary Write Cycle C", 12, 0, 0.0, 119.66666666666667, 103, 204, 110.5, 184.50000000000006, 204.0, 204.0, 0.0593700834149672, 0.06650145085641344, 0.13317683750408169], "isController": true}, {"data": ["Login Admin User", 1, 0, 0.0, 185.0, 185, 185, 185.0, 185.0, 185.0, 185.0, 5.405405405405405, 6.561444256756757, 3.9220861486486487], "isController": false}, {"data": ["Temporary Write Cycle B", 12, 0, 0.0, 115.83333333333333, 101, 193, 110.0, 170.50000000000009, 193.0, 193.0, 0.05937213962348168, 0.06685163768151794, 0.13352933354773272], "isController": true}, {"data": ["Temporary Write Cycle A", 12, 0, 0.0, 123.16666666666667, 103, 210, 112.5, 189.60000000000008, 210.0, 210.0, 0.059369789682520054, 0.06824047114875596, 0.13497350623135418], "isController": true}, {"data": ["Restore Course B", 12, 0, 0.0, 41.25, 34, 105, 36.0, 84.60000000000008, 105.0, 105.0, 0.05939182768451061, 0.02714392124643649, 0.047269862854371236], "isController": false}, {"data": ["Restore Course A", 12, 0, 0.0, 50.0, 35, 133, 39.5, 115.00000000000006, 133.0, 133.0, 0.059393003504187206, 0.027840470392587753, 0.04802481142721387], "isController": false}, {"data": ["Get Enrollments", 600, 0, 0.0, 46.32999999999997, 33, 1140, 39.0, 52.0, 62.0, 293.97, 1.9203564181512087, 2.9050548031714687, 1.7609518326601417], "isController": false}]}, function(index, item){
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
