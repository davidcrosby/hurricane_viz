// Mock for Hurricane Katrina advisory #15
// Size is inaccurate. I think it is because using modern error data for radii
//  which is smaller than in 2005
// TODO: Automate so it can take any advisory as input
var points = [
    [-83.6, 24.6],
    [-84.6, 24.6],
    [-87.5, 26.0],
    [-89.0, 27.0],
    [-89.5, 30.5],
    //[-87.5, 35.0],
    //[-81.0, 40.5]
]

var lines = [
    [[-83.6, 24.6],
    [-84.6, 24.6]],
    [[-84.6, 24.6],
    [-87.5, 26.0]],
    [[-87.5, 26.0],
    [-89.0, 27.0]],
    [[-89.0, 27.0],
    [-89.5, 30.5]]
]

var nhcRadii = [
    0, // Dummy radius
    26 * 1852,
    43 * 1852,
    56 * 1852,
    74 * 1852,
    103 * 1852
].map(x => x/2200);
var width = 800,
    height = 500;

var projection = d3.geoEquirectangular()
    .center([-85, 30])
    .scale(2200);
    //.postclip(d3.geoClipRectangle(-70, 15, -95, 45));

var path = d3.geoPath().projection(projection);

// Convert line coordinates with projection function
for (i = 0; i < lines.length; i++) {
    for (j = 0; j < 2; j++) {
        lines[i][j] = projection(lines[i][j]);
    };
};
function pointDistance(point1, point2) {
    [x, y] = point1;
    [xx, yy] = point2;
    dx = x - xx;
    dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
};

function distance(point, start, end) {
    // https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
    [x, y] = point;
    [x1, y1] = start;
    [x2, y2] = end;
    var A = x - x1;
    var B = y - y1;
    var C = x2 - x1;
    var D = y2 - y1;
  
    var dot = A * C + B * D;
    var len_sq = C * C + D * D;
    var param = -1;
    if (len_sq != 0) //in case of 0 length line
        param = dot / len_sq;
  
    var xx, yy;
  
    if (param < 0) {
      xx = x1;
      yy = y1;
    }
    else if (param > 1) {
      xx = x2;
      yy = y2;
    }
    else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
  
    return {
        distance: pointDistance([x, y], [xx, yy]),
        point: [xx, yy] 
    }
};

function minDistance(point) {
    var min = Infinity;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i],
            radius = nhcRadii[i+1];
        var start = line[0],
            end = line[1];

        // Distance to closest point and the closest point
        var d_obj = distance(point, start, end);

        var d = d_obj.distance;
        var dist_start_intersect = pointDistance(start, d_obj.point); 
        var line_distance = pointDistance(start, end);
        var radius_diff = (nhcRadii[i+2] - nhcRadii[i+1])

        radius = radius + (radius_diff * (dist_start_intersect/line_distance));

        if (d < min && d < radius) {
            min = d;
        };
    };
    if (min === Infinity) {
        return -1;
    } else {
        return min;
    };
};


values = new Array(width * height);
for (var j = 0, k = 0; j < height; ++j) {
    for (var i = 0; i < width; ++i, ++k) {
        values[k] = minDistance([i, j]) 
    }
};

function color(thresholdValue) {
    return d3.hsv(0, 1 - thresholdValue/100, 1);
};

var thresholds = []
for (var i = 0; i < 10; i++) {
    thresholds.push(i * 10);
};
var con = d3.contours().size([width, height]).thresholds(thresholds)(values);
d3.json("states.json", function(error, data) {
    if (error) throw error;
    d3.select("svg")
        .attr("width", width)
        .attr("height", height)
        .append("path")
        .attr("d", path(data))
        .style("fill", "lightblue");

    for (var i = 0; i < con.length; i++) {
        var polygons = con[i].coordinates;
        for (var j = 0; j < polygons.length; j++) {
            var polygon = polygons[j];
            d3.select("svg")
                .append("polygon")
                .attr("points", polygon.map(function(e) {
                    return e.join(",");
                }).join(" "))
                .attr("fill", color(con[i].value))
                .attr("stroke", "white")
                .attr("stroke-width", 0);
        }
    };
    // Draw points for each 12hr forecast
    d3.select("svg").selectAll("dot")
        .data(points).enter()
        .append("circle")
        .attr("cx", function(d) { 
            return projection(d)[0];
        })
        .attr("cy", function(d) { 
            return projection(d)[1];
        })
        .attr("r", "8px")
        .attr("fill", "red");
    // Draw lines connecting the points
    d3.select("svg").selectAll("lines")
        .data(lines).enter()
        .append("line")
        .attr("x1", function(d) {
            var p = d[0];
            return p[0];
        })
        .attr("y1", function(d) {
            var p = d[0];
            return p[1];
        })
        .attr("x2", function(d) {
            var p = d[1];
            return p[0];
        }) 
        .attr("y2", function(d) {
            var p = d[1];
            return p[1];
        })
        .attr("stroke-width", 2)
        .attr("stroke", "red");
});