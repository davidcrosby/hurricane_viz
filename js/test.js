

var isolatedSplat = function(x, y, map) {
    // length and width
    var volume = 15;
    var max_height = volume*3;

    var baseLength = 1//Math.round(1 + (time/120)*max_size);
    // V = lwh/3
    if (baseLength == 1) {
        map[x][y] = max_height;
        return map;
    };
    var height = 3 * volume / (baseLength**2)


    if(x < baseLength/2 || y < baseLength/2) 
        return;
    var xDelta = Math.floor(baseLength/2),
        yDelta = Math.floor(baseLength/2);

    var pointDistance = function(x1, y1, x2, y2) {
        return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
    };
    var maxDistance = pointDistance(x, y, x-xDelta - 0.5, y-yDelta - 0.5) ;
    var layerSize = 2 * xDelta;
    var xp = x - xDelta,
        yp = y - yDelta;
    while(xp <= x && yp <= y) {
        // Distance from starting corner to furthest starting corner
        if (x != xp && y != yp) {
            var pd = pointDistance(xp, yp, x - xDelta - 0.5, y - yDelta - 0.5);
        } else {
            map[xp][yp] = height;
            break;
        };
        for(var i = xp; i <= xp + layerSize; i++) {
            for(var j = yp; j <= yp + layerSize; j++) {
                if (i != xp && j != yp && i != xp+layerSize && j != yp+layerSize)
                    continue;
                var heightAtThisPoint = height*(pd/maxDistance);
                if(map[i][j]) {
                    map[i][j] += heightAtThisPoint;
                } else {
                    map[i][j] = heightAtThisPoint;
                };
            };
        };
        layerSize -= 2;
        xp += 1;
        yp += 1;
    }
    return map;
};

var mmap = {}
for(var i = 0; i < 10; i++) {
    mmap[i] = {}
}
console.log(isolatedSplat(5, 5, mmap));