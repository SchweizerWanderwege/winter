var size = 0;
var placement = 'point';
function categories_Winterwanderwege_3(feature, value, size, resolution, labelText,
                       labelFont, labelFill, bufferColor, bufferWidth,
                       placement)  {

    var valueStr = (value !== null && value !== undefined) ? value.toString() : 'default';

    // Zoomstufen
    if (resolution >= 20) {
        widthInner = 4;
        widthOuter = 0;
    }
    else if (resolution >= 5) {
        widthInner = 4;
        widthOuter = 8;
    }
    else if (resolution >= 1) {
        widthInner = 5;
        widthOuter = 20;
    }

    switch(valueStr) {

        case '1':

            return [
                new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'rgba(224,68,194,0.7)',
                        lineCap: 'round',
                        lineJoin: 'round',
                        width: widthInner
                    }),
                    text: createTextStyle(feature, resolution, labelText, labelFont,
                                          labelFill, placement, bufferColor,
                                          bufferWidth)
                }),
                new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'rgba(165,28,113,0.4)',
                        lineCap: 'round',
                        lineJoin: 'round',
                        width: widthOuter
                    })
                })
            ];

        case '0':

            return [
                new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'rgba(224,68,194,0.7)',
                        lineCap: 'round',
                        lineJoin: 'round',
                        width: widthInner
                    }),
                    text: createTextStyle(feature, resolution, labelText, labelFont,
                                          labelFill, placement, bufferColor,
                                          bufferWidth)
                })
            ];
    }
}

var style_Winterwanderwege_3 = function(feature, resolution){

    var labelText = "";
    var value = feature.get("IsCHM");

    var labelFont = "10px sans-serif";
    var labelFill = "#000000";
    var bufferColor = "";
    var bufferWidth = 0;
    var placement = 'line';
    
    var style = categories_Winterwanderwege_3(
        feature,
        value,
        size,
        resolution,
        labelText,
        labelFont,
        labelFill,
        bufferColor,
        bufferWidth,
        placement
    );

    return style;
};
