
var map = new ol.Map({
    target: 'map',
    renderer: 'canvas',
    layers: layersList,
    view: new ol.View({
         maxZoom: 18, minZoom: 8
    })
});

//initial view - epsg:3857 coordinates if not "Match project CRS"
map.getView().fit([558141.226071, 5672837.007197, 1301919.467774, 6156928.106533], map.getSize());

////small screen definition
    var hasTouchScreen = map.getViewport().classList.contains('ol-touch');
    var isSmallScreen = window.innerWidth < 650;

////controls container

    //top left container
    var topLeftContainer = new ol.control.Control({
        element: (() => {
            var topLeftContainer = document.createElement('div');
            topLeftContainer.id = 'top-left-container';
            return topLeftContainer;
        })(),
    });
    map.addControl(topLeftContainer)

    //bottom left container
    var bottomLeftContainer = new ol.control.Control({
        element: (() => {
            var bottomLeftContainer = document.createElement('div');
            bottomLeftContainer.id = 'bottom-left-container';
            return bottomLeftContainer;
        })(),
    });
    map.addControl(bottomLeftContainer)
  
    //top right container
    var topRightContainer = new ol.control.Control({
        element: (() => {
            var topRightContainer = document.createElement('div');
            topRightContainer.id = 'top-right-container';
            return topRightContainer;
        })(),
    });
    map.addControl(topRightContainer)

    //bottom right container
    var bottomRightContainer = new ol.control.Control({
        element: (() => {
            var bottomRightContainer = document.createElement('div');
            bottomRightContainer.id = 'bottom-right-container';
            return bottomRightContainer;
        })(),
    });
    map.addControl(bottomRightContainer)

//popup
var container = document.getElementById('popup');
var content = document.getElementById('popup-content');
var closer = document.getElementById('popup-closer');
var sketch;

closer.onclick = function() {
    container.style.display = 'none';
    closer.blur();
    return false;
};
var overlayPopup = new ol.Overlay({
    element: container
});
map.addOverlay(overlayPopup)
    
    
var NO_POPUP = 0
var ALL_FIELDS = 1

/**
 * Returns either NO_POPUP, ALL_FIELDS or the name of a single field to use for
 * a given layer
 * @param layerList {Array} List of ol.Layer instances
 * @param layer {ol.Layer} Layer to find field info about
 */
function getPopupFields(layerList, layer) {
    // Determine the index that the layer will have in the popupLayers Array,
    // if the layersList contains more items than popupLayers then we need to
    // adjust the index to take into account the base maps group
    var idx = layersList.indexOf(layer) - (layersList.length - popupLayers.length);
    return popupLayers[idx];
}

//highligth collection
var collection = new ol.Collection();
var featureOverlay = new ol.layer.Vector({
    map: map,
    source: new ol.source.Vector({
        features: collection,
        useSpatialIndex: false // optional, might improve performance
    }),
    style: [new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#f00',
            width: 1
        }),
        fill: new ol.style.Fill({
            color: 'rgba(255,0,0,0.1)'
        }),
    })],
    updateWhileAnimating: true, // optional, for instant visual feedback
    updateWhileInteracting: true // optional, for instant visual feedback
});

var doHighlight = true;
var doHover = false;

function createPopupField(currentFeature, currentFeatureKeys, layer) {
    var popupText = '';
    for (var i = 0; i < currentFeatureKeys.length; i++) {
        if (currentFeatureKeys[i] != 'geometry') {
            var popupField = '';
            if (layer.get('fieldLabels')[currentFeatureKeys[i]] == "hidden field") {
                continue;
            } else if (layer.get('fieldLabels')[currentFeatureKeys[i]] == "inline label - visible with data") {
                if (currentFeature.get(currentFeatureKeys[i]) == null) {
                    continue;
                }
            }
            if (layer.get('fieldLabels')[currentFeatureKeys[i]] == "inline label - always visible" ||
                layer.get('fieldLabels')[currentFeatureKeys[i]] == "inline label - visible with data") {
                popupField += '<th>' + layer.get('fieldAliases')[currentFeatureKeys[i]] + '</th><td>';
            } else {
                popupField += '<td colspan="2">';
            }
            if (layer.get('fieldLabels')[currentFeatureKeys[i]] == "header label - visible with data") {
                if (currentFeature.get(currentFeatureKeys[i]) == null) {
                    continue;
                }
            }
            if (layer.get('fieldLabels')[currentFeatureKeys[i]] == "header label - always visible" ||
                layer.get('fieldLabels')[currentFeatureKeys[i]] == "header label - visible with data") {
                popupField += '<strong>' + layer.get('fieldAliases')[currentFeatureKeys[i]] + '</strong><br />';
            }
            if (layer.get('fieldImages')[currentFeatureKeys[i]] != "ExternalResource") {
				popupField += (currentFeature.get(currentFeatureKeys[i]) != null ? autolinker.link(currentFeature.get(currentFeatureKeys[i]).toLocaleString()) + '</td>' : '');
			} else {
				var fieldValue = currentFeature.get(currentFeatureKeys[i]);
				if (/\.(gif|jpg|jpeg|tif|tiff|png|avif|webp|svg)$/i.test(fieldValue)) {
					popupField += (fieldValue != null ? '<img src="images/' + fieldValue.replace(/[\\\/:]/g, '_').trim() + '" /></td>' : '');
				} else if (/\.(mp4|webm|ogg|avi|mov|flv)$/i.test(fieldValue)) {
					popupField += (fieldValue != null ? '<video controls><source src="images/' + fieldValue.replace(/[\\\/:]/g, '_').trim() + '" type="video/mp4">Il tuo browser non supporta il tag video.</video></td>' : '');
				} else {
					popupField += (fieldValue != null ? autolinker.link(fieldValue.toLocaleString()) + '</td>' : '');
				}
			}
            popupText += '<tr>' + popupField + '</tr>';
        }
    }
    return popupText;
}

var highlight;
var autolinker = new Autolinker({truncate: {length: 30, location: 'smart'}});

function onPointerMove(evt) {
    if (!doHover && !doHighlight) {
        return;
    }
    var pixel = map.getEventPixel(evt.originalEvent);
    var coord = evt.coordinate;
    var currentFeature;
    var currentLayer;
    var currentFeatureKeys;
    var clusteredFeatures;
    var clusterLength;
    var popupText = '<ul>';
    map.forEachFeatureAtPixel(pixel, function(feature, layer) {
        if (layer && feature instanceof ol.Feature && (layer.get("interactive") || layer.get("interactive") == undefined)) {
            var doPopup = false;
            for (k in layer.get('fieldImages')) {
                if (layer.get('fieldImages')[k] != "Hidden") {
                    doPopup = true;
                }
            }
            currentFeature = feature;
            currentLayer = layer;
            clusteredFeatures = feature.get("features");
            if (clusteredFeatures) {
				clusterLength = clusteredFeatures.length;
			}
            if (typeof clusteredFeatures !== "undefined") {
                if (doPopup) {
                    for(var n=0; n<clusteredFeatures.length; n++) {
                        currentFeature = clusteredFeatures[n];
                        currentFeatureKeys = currentFeature.getKeys();
                        popupText += '<li><table>'
                        popupText += '<a>' + '<b>' + layer.get('popuplayertitle') + '</b>' + '</a>';
                        popupText += createPopupField(currentFeature, currentFeatureKeys, layer);
                        popupText += '</table></li>';    
                    }
                }
            } else {
                currentFeatureKeys = currentFeature.getKeys();
                if (doPopup) {
                    popupText += '<li><table>';
                    popupText += '<a>' + '<b>' + layer.get('popuplayertitle') + '</b>' + '</a>';
                    popupText += createPopupField(currentFeature, currentFeatureKeys, layer);
                    popupText += '</table></li>';
                }
            }
        }
    });
    if (popupText == '<ul>') {
        popupText = '';
    } else {
        popupText += '</ul>';
    }
    
	if (doHighlight) {
        if (currentFeature !== highlight) {
            if (highlight) {
                featureOverlay.getSource().removeFeature(highlight);
            }
            if (currentFeature) {
                var featureStyle
                if (typeof clusteredFeatures == "undefined") {
					var style = currentLayer.getStyle();
					var styleFunction = typeof style === 'function' ? style : function() { return style; };
					featureStyle = styleFunction(currentFeature)[0];
				} else {
					featureStyle = currentLayer.getStyle().toString();
				}

                if (currentFeature.getGeometry().getType() == 'Point' || currentFeature.getGeometry().getType() == 'MultiPoint') {
                    var radius
					if (typeof clusteredFeatures == "undefined") {
						radius = featureStyle.getImage().getRadius();
					} else {
						radius = parseFloat(featureStyle.split('radius')[1].split(' ')[1]) + clusterLength;
					}

                    highlightStyle = new ol.style.Style({
                        image: new ol.style.Circle({
                            fill: new ol.style.Fill({
                                color: "#ffff00"
                            }),
                            radius: radius
                        })
                    })
                } else if (currentFeature.getGeometry().getType() == 'LineString' || currentFeature.getGeometry().getType() == 'MultiLineString') {

                    var featureWidth = featureStyle.getStroke().getWidth();

                    highlightStyle = new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: '#faafb8',
                            lineDash: null,
                            width: featureWidth
                        })
                    });

                } else {
                    highlightStyle = new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: '#ffff00'
                        })
                    })
                }
                featureOverlay.getSource().addFeature(currentFeature);
                featureOverlay.setStyle(highlightStyle);
            }
            highlight = currentFeature;
        }
    }

    if (doHover) {
        if (popupText) {
            overlayPopup.setPosition(coord);
            content.innerHTML = popupText;
            container.style.display = 'block';        
        } else {
            container.style.display = 'none';
            closer.blur();
        }
    }
};

map.on('pointermove', onPointerMove);

var popupContent = '';
var popupCoord = null;
var featuresPopupActive = false;

function updatePopup() {
    if (popupContent) {
        overlayPopup.setPosition(popupCoord);
        content.innerHTML = popupContent;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
        closer.blur();
    }
} 

function onSingleClickFeatures(evt) {
    if (doHover || sketch) {
        return;
    }
    if (!featuresPopupActive) {
        featuresPopupActive = true;
    }
    var pixel = map.getEventPixel(evt.originalEvent);
    var coord = evt.coordinate;
    var currentFeature;
    var currentFeatureKeys;
    var clusteredFeatures;
    var popupText = '<ul>';
    
    map.forEachFeatureAtPixel(pixel, function(feature, layer) {
        if (layer && feature instanceof ol.Feature && (layer.get("interactive") || layer.get("interactive") === undefined)) {
            var doPopup = false;
            for (var k in layer.get('fieldImages')) {
                if (layer.get('fieldImages')[k] !== "Hidden") {
                    doPopup = true;
                }
            }
            currentFeature = feature;
            clusteredFeatures = feature.get("features");
            if (typeof clusteredFeatures !== "undefined") {
                if (doPopup) {
                    for(var n = 0; n < clusteredFeatures.length; n++) {
                        currentFeature = clusteredFeatures[n];
                        currentFeatureKeys = currentFeature.getKeys();
                        popupText += '<li><table>';
                        popupText += '<a><b>' + layer.get('popuplayertitle') + '</b></a>';
                        popupText += createPopupField(currentFeature, currentFeatureKeys, layer);
                        popupText += '</table></li>';    
                    }
                }
            } else {
                currentFeatureKeys = currentFeature.getKeys();
                if (doPopup) {
                    popupText += '<li><table>';
                    popupText += '<a><b>' + layer.get('popuplayertitle') + '</b></a>';
                    popupText += createPopupField(currentFeature, currentFeatureKeys, layer);
                    popupText += '</table>';
                }
            }
        }
    });
    if (popupText === '<ul>') {
        popupText = '';
    } else {
        popupText += '</ul>';
    }
	
	popupContent = popupText;
    popupCoord = coord;
    updatePopup();
}

function onSingleClickWMS(evt) {
    if (doHover || sketch) {
        return;
    }
	if (!featuresPopupActive) {
		popupContent = '';
	}
    var coord = evt.coordinate;
    var viewProjection = map.getView().getProjection();
    var viewResolution = map.getView().getResolution();

    for (var i = 0; i < wms_layers.length; i++) {
        if (wms_layers[i][1] && wms_layers[i][0].getVisible()) {
            var url = wms_layers[i][0].getSource().getFeatureInfoUrl(
                evt.coordinate, viewResolution, viewProjection, {
                    'INFO_FORMAT': 'text/html',
                });
            if (url) {				
                const wmsTitle = wms_layers[i][0].get('popuplayertitle');					
                var ldsRoller = '<div id="lds-roller"><img class="lds-roller-img" style="height: 25px; width: 25px;"></img></div>';
				
                popupCoord = coord;
				popupContent += ldsRoller;
                updatePopup();

                var timeoutPromise = new Promise((resolve, reject) => {
                    setTimeout(() => {
                        reject(new Error('Timeout exceeded'));
                    }, 5000); // (5 second)
                });

                Promise.race([
                    fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url)),
                    timeoutPromise
                ])
                .then((response) => {
                    if (response.ok) {
                        return response.text();
                    }
                })
                .then((html) => {
                    if (html.indexOf('<table') !== -1) {
                        popupContent += '<a><b>' + wmsTitle + '</b></a>';
                        popupContent += html + '<p></p>';
                        updatePopup();
                    }
                })
                // .catch((error) => {
				// })
                .finally(() => {
                    setTimeout(() => {
                        var loaderIcon = document.querySelector('#lds-roller');
						loaderIcon.remove();
                    }, 500); // (0.5 second)	
                });
            }
        }
    }
}

//map.on('singleclick', onSingleClickFeatures);
//map.on('singleclick', onSingleClickWMS);

//get container
var topLeftContainerDiv = document.getElementById('top-left-container')
var bottomLeftContainerDiv = document.getElementById('bottom-left-container')
var bottomRightContainerDiv = document.getElementById('bottom-right-container')

//title

//abstract


//geolocate



//measurement





//geocoder

var geocoder = new Geocoder('nominatim', {
  provider: 'osm',
  lang: 'en-US',
  placeholder: 'Search place or address ...',
  limit: 5,
  keepOpen: true,
});
map.addControl(geocoder);
document.getElementsByClassName('gcd-gl-btn')[0].className += ' fa fa-search';


//layer search

var searchLayer = new SearchLayer({
    layer: lyr_Winterwanderwege_3,
    colName: 'NameR',
    zoom: 10,
    collapsed: true,
    map: map
});
map.addControl(searchLayer);
document.getElementsByClassName('search-layer')[0].getElementsByTagName('button')[0].className += ' fa fa-binoculars';
document.getElementsByClassName('search-layer-input-search')[0].placeholder = 'Search feature ...';
    

//scalebar


//layerswitcher
/*
var layerSwitcher = new ol.control.LayerSwitcher({
    tipLabel: "Layers",
    target: 'top-right-container'
});
map.addControl(layerSwitcher);
*/    





//attribution
var bottomAttribution = new ol.control.Attribution({
  collapsible: false,
  collapsed: false,
  className: 'bottom-attribution'
});
map.addControl(bottomAttribution);

var attributionList = document.createElement('li');
attributionList.innerHTML = `
	<a href="https://github.com/qgis2web/qgis2web">qgis2web</a> &middot;
	<a href="https://openlayers.org/">OpenLayers</a> &middot;
 	<a href="https://www.schweizer-wanderwege.ch/de/wir-packen-an/winterwander-basisnetz">SWW-Winter</a> &middot;
	<a href="https://qgis.org/">QGIS</a> &middot;	
`;
var bottomAttributionUl = bottomAttribution.element.querySelector('ul');
if (bottomAttributionUl) {
  bottomAttribution.element.insertBefore(attributionList, bottomAttributionUl);
}


// Disable "popup on hover" or "highlight on hover" if ol-control mouseover
var preDoHover = doHover;
var preDoHighlight = doHighlight;
var isPopupAllActive = false;
document.addEventListener('DOMContentLoaded', function() {
	if (doHover || doHighlight) {
		var controlElements = document.getElementsByClassName('ol-control');
		for (var i = 0; i < controlElements.length; i++) {
			controlElements[i].addEventListener('mouseover', function() { 
				doHover = false;
				doHighlight = false;
			});
			controlElements[i].addEventListener('mouseout', function() {
				doHover = preDoHover;
				if (isPopupAllActive) { return }
				doHighlight = preDoHighlight;
			});
		}
	}
});


//move controls inside containers, in order
    //zoom
    var zoomControl = document.getElementsByClassName('ol-zoom')[0];
    if (zoomControl) {
        topLeftContainerDiv.appendChild(zoomControl);
    }
    //geolocate
    var geolocateControl = document.getElementsByClassName('geolocate')[0];
    if (geolocateControl) {
        topLeftContainerDiv.appendChild(geolocateControl);
    }
    //measure
    var measureControl = document.getElementsByClassName('measure-control')[0];
    if (measureControl) {
        topLeftContainerDiv.appendChild(measureControl);
    }
    //geocoder
    var geocoderControl = document.getElementsByClassName('ol-geocoder')[0];
    if (geocoderControl) {
        topLeftContainerDiv.appendChild(geocoderControl);
    }
    //search layer
    var searchLayerControl = document.getElementsByClassName('search-layer')[0];
    if (searchLayerControl) {
        topLeftContainerDiv.appendChild(searchLayerControl);
    }
    //scale line
    var scaleLineControl = document.getElementsByClassName('ol-scale-line')[0];
    if (scaleLineControl) {
        scaleLineControl.className += ' ol-control';
        bottomLeftContainerDiv.appendChild(scaleLineControl);
    }
    //attribution
    var attributionControl = document.getElementsByClassName('bottom-attribution')[0];
    if (attributionControl) {
        bottomRightContainerDiv.appendChild(attributionControl);
    }

	// Create a div element for the overlay
	var lastWorkedOnDiv = document.createElement('div');
	lastWorkedOnDiv.id = 'last-worked-on';
	lastWorkedOnDiv.style.position = 'absolute';
	lastWorkedOnDiv.style.bottom = '20px';
	lastWorkedOnDiv.style.right = '10px';
	lastWorkedOnDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
	lastWorkedOnDiv.style.padding = '5px';
	lastWorkedOnDiv.style.border = '1px solid #ccc';
	lastWorkedOnDiv.style.borderRadius = '3px';
	
	// Set the content of the overlay
	var lastWorkedOnDate = new Date('2026-09-14').toLocaleDateString(); // Replace with the actual date
	lastWorkedOnDiv.innerHTML = 'Datenstand: ' + lastWorkedOnDate;
	
	// Create a new control for the overlay
	var lastWorkedOnControl = new ol.control.Control({
	    element: lastWorkedOnDiv
	});
	
	// Add the control to the map
	map.addControl(lastWorkedOnControl);


// Function BLOCK
(function () {
    var selectedRouteLayer = new ol.layer.Vector({
        source: new ol.source.Vector(),
        zIndex: 1,
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'rgba(255,0,0,0.25)',
                width: 12
            })
        })
    });

    var distanceSlider =
        document.getElementById(
            'route-distance-slider'
        );

    var distanceValue =
        document.getElementById(
            'route-distance-value'
        );

    var distanceLimitMin =
        document.getElementById(
            'route-distance-limit-min'
        );

    var distanceLimitMax =
        document.getElementById(
            'route-distance-limit-max'
        );

    var selectedDistanceMinimum = null;
    var selectedDistanceMaximum = null;

    var distanceSliderInitialized = false;

    map.addLayer(selectedRouteLayer);
    var routeList = document.getElementById('route-list');
    var routeStatus = document.getElementById('route-panel-status');
    var selectedRouteId = null;
    var mapFilters = {
        www: true,
        ssww: true,
        bestof: true,
        basisnetz: true
    };

    var mapSelection = document.getElementById('map-selection');

    var originalWinterStyle = lyr_Winterwanderwege_3.getStyle();
    var originalSnowshoeStyle = lyr_Schneeschuhwanderwege_1.getStyle();

    function normalizeIsCHM(value) {
        if (
            value === 1 ||
            value === true ||
            String(value).trim() === '1'
        ) {
            return 1;
        }

        if (
            value === 0 ||
            value === false ||
            String(value).trim() === '0'
        ) {
            return 0;
        }

        return null;
    }

    function routeMatchesMapFilters(feature) {
        var routeType = feature.get('LvArt');
        var isCHM = normalizeIsCHM(feature.get('IsCHM'));

        var routeTypeMatches =
            (
                routeType === 'Winterwanderwege' &&
                mapFilters.www
            ) ||
            (
                routeType === 'Schneeschuhrouten' &&
                mapFilters.ssww
            );

        var networkTypeMatches =
            (
                isCHM === 1 &&
                mapFilters.bestof
            ) ||
            (
                isCHM === 0 &&
                mapFilters.basisnetz
            );

        return routeTypeMatches && networkTypeMatches;
    }

    function applyOriginalStyle(style, feature, resolution) {
        if (typeof style === 'function') {
            return style(feature, resolution);
        }

        return style;
    }

    function applyMapFilters() {
        lyr_Winterwanderwege_3.setStyle(
            function (feature, resolution) {
                if (!routeMatchesMapFilters(feature)) {
                    return undefined;
                }

                return applyOriginalStyle(
                    originalWinterStyle,
                    feature,
                    resolution
                );
            }
        );

        lyr_Schneeschuhwanderwege_1.setStyle(
            function (feature, resolution) {
                if (!routeMatchesMapFilters(feature)) {
                    return undefined;
                }

                return applyOriginalStyle(
                    originalSnowshoeStyle,
                    feature,
                    resolution
                );
            }
        );

        if (selectedRouteId) {
            var selectedFeature = null;

            [
                jsonSource_Winterwanderwege_3,
                jsonSource_Schneeschuhwanderwege_1
            ].some(function (source) {
                selectedFeature = source.getFeatures().find(
                    function (feature) {
                        return (
                            String(feature.get('NrR_ID')) ===
                            selectedRouteId
                        );
                    }
                );

                return selectedFeature != null;
            });

            if (
                selectedFeature &&
                !routeMatchesMapFilters(selectedFeature)
            ) {
                selectedRouteId = null;
                selectedRouteLayer.getSource().clear();
            }
        }

        updateVisibleRouteList();
        updateDistanceFilter();
    }
    var routeSearchInput = document.getElementById('route-search-input');
    var routeSearchClear = document.getElementById('route-search-clear');
    var routeSearchTerm = '';
    var routeSearchFilters =
        document.getElementById('route-search-filters');

    var routeSearchFiltersToggle =
        document.getElementById(
            'route-search-filters-toggle'
        );

    if (!routeList || !routeStatus) {
        console.warn('Routenpanel wurde im HTML nicht gefunden.');
        return;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getVisibleFeatures(source, extent) {
        if (!source) {
            return [];
        }

        return source.getFeaturesInExtent(extent).filter(function (feature) {
            return feature && feature.getGeometry();
        });
    }

    function createRouteRecord(feature, defaultType) {
        var routeType = feature.get('LvArt') || defaultType;
        var routeId = feature.get('NrR_ID');

        return {
            id: routeId == null ? '' : String(routeId),
            name: feature.get('NameR') || 'Route ohne Namen',
            type: routeType,
            distance: feature.get('LaengeR'),
            duration: feature.get('ZeitStZiR'),
            ascent: feature.get('HoeheAufR'),
            descent: feature.get('HoeheAbR'),
            difficulty: feature.get('KonditionR'),
            feature: feature
        };
    }

    function formatDistance(value) {
        var metres = Number(value);

        if (!Number.isFinite(metres)) {
            return 'Keine Distanz';
        }

        return (metres / 1000).toLocaleString(
            'de-CH',
            {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }
        ) + ' km';
    }

    function formatDuration(value) {
        var minutes = Math.round(Number(value));

        if (!Number.isFinite(minutes)) {
            return 'Keine Dauer';
        }

        var hours = Math.floor(minutes / 60);
        var remainingMinutes = minutes % 60;

        if (hours === 0) {
            return remainingMinutes + ' min';
        }

        if (remainingMinutes === 0) {
            return hours + ' h';
        }

        return hours + ' h ' + remainingMinutes + ' min';
    }

    function formatElevation(value) {
        var metres = Math.round(Number(value));

        if (!Number.isFinite(metres)) {
            return '–';
        }

        return metres.toLocaleString('de-CH') + ' m';
    }

    function formatDistanceValue(value) {
        return Number(value).toLocaleString(
            'de-CH',
            {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }
        ) + ' km';
    }

    function getDistanceStatistics() {
        var distances = [];

        [
            jsonSource_Winterwanderwege_3,
            jsonSource_Schneeschuhwanderwege_1
        ].forEach(function (source) {
            source.getFeatures().forEach(function (feature) {
                if (!routeMatchesMapFilters(feature)) {
                    return;
                }

                var distance =
                    Number(feature.get('LaengeR')) / 1000;

                if (
                    Number.isFinite(distance) &&
                    distance >= 0
                ) {
                    distances.push(distance);
                }
            });
        });

        if (distances.length === 0) {
            return null;
        }

        var minimum =
            Math.floor(
                Math.min.apply(null, distances) * 10
            ) / 10;

        var maximum =
            Math.ceil(
                Math.max.apply(null, distances) * 10
            ) / 10;

        if (minimum === maximum) {
            maximum = minimum + 0.1;
        }

        return {
            min: minimum,
            max: maximum
        };
    }

    function updateDistanceFilter() {
        if (
            !distanceSlider ||
            !distanceValue ||
            !distanceLimitMin ||
            !distanceLimitMax
        ) {
            return;
        }

        var stats = getDistanceStatistics();

        if (!stats) {
            distanceValue.textContent =
                'Keine verfügbaren Routen';

            distanceLimitMin.textContent = 'Min.';
            distanceLimitMax.textContent = 'Max.';

            distanceSlider.setAttribute(
                'disabled',
                'disabled'
            );

            return;
        }

        distanceSlider.removeAttribute('disabled');

        selectedDistanceMinimum = stats.min;
        selectedDistanceMaximum = stats.max;

        distanceLimitMin.textContent =
            formatDistanceValue(stats.min);

        distanceLimitMax.textContent =
            formatDistanceValue(stats.max);

        distanceValue.textContent =
            formatDistanceValue(stats.min) +
            ' bis ' +
            formatDistanceValue(stats.max);

        var tooltipFormatter = {
            to: function (value) {
                return formatDistanceValue(value);
            },
            from: function (value) {
                return Number(
                    String(value).replace(',', '.')
                );
            }
        };

        if (!distanceSliderInitialized) {
            noUiSlider.create(
                distanceSlider,
                {
                    start: [
                        stats.min,
                        stats.max
                    ],
                    connect: true,
                    step: 0.1,
                    range: {
                        min: stats.min,
                        max: stats.max
                    },
                    tooltips: [
                        tooltipFormatter,
                        tooltipFormatter
                    ]
                }
            );

            distanceSlider.noUiSlider.on(
                'update',
                function (values) {
                    selectedDistanceMinimum =
                        Number(values[0]);

                    selectedDistanceMaximum =
                        Number(values[1]);

                    distanceValue.textContent =
                        formatDistanceValue(
                            selectedDistanceMinimum
                        ) +
                        ' bis ' +
                        formatDistanceValue(
                            selectedDistanceMaximum
                        );
                }
            );

            distanceSliderInitialized = true;
            return;
        }

        distanceSlider.noUiSlider.updateOptions(
            {
                range: {
                    min: stats.min,
                    max: stats.max
                },
                start: [
                    stats.min,
                    stats.max
                ],
                step: 0.1
            },
            true
        );
    }    

    function updateVisibleRouteList() {
        var extent = map.getView().calculateExtent(map.getSize());

        var snowFeatures = getVisibleFeatures(
            jsonSource_Schneeschuhwanderwege_1,
            extent
        ).filter(routeMatchesMapFilters);

        var winterFeatures = getVisibleFeatures(
            jsonSource_Winterwanderwege_3,
            extent
        ).filter(routeMatchesMapFilters);

        var routes = [];

        snowFeatures.forEach(function (feature) {
            routes.push(
                createRouteRecord(feature, 'Schneeschuhrouten')
            );
        });

        winterFeatures.forEach(function (feature) {
            routes.push(
                createRouteRecord(feature, 'Winterwanderwege')
            );
        });

        var uniqueRoutes = {};

        routes.forEach(function (route) {
            var key = route.id || route.type + '|' + route.name;

            if (!uniqueRoutes[key]) {
                uniqueRoutes[key] = route;
            }
        });

        routes = Object.keys(uniqueRoutes).map(function (key) {
            return uniqueRoutes[key];
        });

        if (routeSearchTerm) {
            routes = routes.filter(function (route) {
                return String(route.name)
                    .toLocaleLowerCase('de-CH')
                    .includes(routeSearchTerm);
            });
        }

        routes.sort(function (routeA, routeB) {
            return routeA.name.localeCompare(
                routeB.name,
                'de-CH',
                {
                    sensitivity: 'base',
                    numeric: true
                }
            );
        });

        routeStatus.textContent =
            routes.length === 1
                ? '1 sichtbare Route'
                : routes.length + ' sichtbare Routen';

        if (routes.length === 0) {
            routeList.innerHTML =
                '<p class="route-list-empty">' +
                'In diesem Kartenausschnitt sind keine Routen sichtbar.' +
                '</p>';

            return;
        }

        routeList.innerHTML = routes.map(function (route) {
            var isSnowshoe =
                route.type === 'Schneeschuhrouten';

            var typeClass = isSnowshoe
                ? 'route-type-snowshoe'
                : 'route-type-winter';

            var typeLabel = isSnowshoe
                ? 'Schneeschuhwanderweg'
                : 'Winterwanderweg';

            var typeSymbol = isSnowshoe ? 'SSWW' : 'WWW';

            var activeClass =
                route.id === selectedRouteId
                    ? ' route-list-item-active'
                    : '';

            return (
                '<button class="route-list-item' +
                activeClass +
                '" ' +
                'type="button" ' +
                'data-route-id="' + escapeHtml(route.id) + '">' +

                    '<span class="route-list-type ' +
                    typeClass + '">' +

                        '<span class="route-type-symbol">' +
                        typeSymbol +
                        '</span>' +

                        '<span>' +
                        escapeHtml(typeLabel) +
                        '</span>' +

                    '</span>' +

                    '<strong class="route-list-name">' +
                    escapeHtml(route.name) +
                    '</strong>' +

                    '<span class="route-list-facts">' +
                        '<span>' +
                        escapeHtml(formatDistance(route.distance)) +
                        '</span>' +

                        '<span aria-hidden="true">·</span>' +

                        '<span>' +
                        escapeHtml(formatDuration(route.duration)) +
                        '</span>' +
                    '</span>' +

                    '<span class="route-list-elevation">' +
                        '<span>↑ ' +
                        escapeHtml(formatElevation(route.ascent)) +
                        '</span>' +

                        '<span>↓ ' +
                        escapeHtml(formatElevation(route.descent)) +
                        '</span>' +
                    '</span>' +

                    '<span class="route-list-difficulty">' +
                    escapeHtml(route.difficulty || 'Keine Angabe') +
                    '</span>' +

                '</button>'
            );
        }).join('');
    }

    map.on('moveend', updateVisibleRouteList);

    function handleRouteSourceReady() {
        updateVisibleRouteList();

        if (
            routeSearchFilters &&
            !routeSearchFilters.hidden
        ) {
            updateDistanceFilter();
        }
    }

    jsonSource_Winterwanderwege_3.on(
        'featuresloadend',
        handleRouteSourceReady
    );

    jsonSource_Schneeschuhwanderwege_1.on(
        'featuresloadend',
        handleRouteSourceReady
    );

    jsonSource_Winterwanderwege_3.on(
        'change',
        function () {
            if (
                jsonSource_Winterwanderwege_3.getState() ===
                'ready'
            ) {
                handleRouteSourceReady();
            }
        }
    );

    jsonSource_Schneeschuhwanderwege_1.on(
        'change',
        function () {
            if (
                jsonSource_Schneeschuhwanderwege_1.getState() ===
                'ready'
            ) {
                handleRouteSourceReady();
            }
        }
    );
    routeList.addEventListener('click', function (event) {

        var button = event.target.closest('.route-list-item');

        if (!button) {
            return;
        }

        var routeId = button.dataset.routeId;
        selectedRouteId = routeId;

        if (!routeId) {
            return;
        }

        var feature = null;

        [
            jsonSource_Winterwanderwege_3,
            jsonSource_Schneeschuhwanderwege_1
        ].some(function (source) {

            feature = source.getFeatures().find(function (candidate) {
                return String(candidate.get('NrR_ID')) === routeId;
            });

            return !!feature;
        });

        if (!feature) {
            return;
        }

        var geometry = feature.getGeometry();

        if (!geometry) {
            return;
        }
        selectedRouteLayer.getSource().clear();

        selectedRouteLayer.getSource().addFeature(
            feature.clone()
        );

        updateVisibleRouteList();

        map.getView().fit(
            geometry.getExtent(),
            {
                padding: [80, 80, 80, 420],
                duration: 600,
                maxZoom: 15
            }
        );

    });

    map.on('singleclick', function (event) {
        var clickedFeature = null;

        map.forEachFeatureAtPixel(
            event.pixel,
            function (feature, layer) {
                if (
                    layer === lyr_Winterwanderwege_3 ||
                    layer === lyr_Schneeschuhwanderwege_1
                ) {
                    clickedFeature = feature;
                    return true;
                }
            },
            {
                hitTolerance: 5
            }
        );

        if (!clickedFeature) {
            return;
        }

        var routeId = clickedFeature.get('NrR_ID');

        if (routeId == null || String(routeId).trim() === '') {
            return;
        }

        selectedRouteId = String(routeId);

        selectedRouteLayer.getSource().clear();

        selectedRouteLayer.getSource().addFeature(
            clickedFeature.clone()
        );

        updateVisibleRouteList();

        var geometry = clickedFeature.getGeometry();

        if (geometry) {
            map.getView().fit(
                geometry.getExtent(),
                {
                    padding: [80, 80, 80, 420],
                    duration: 600,
                    maxZoom: 15
                }
            );
        }

        var activeListItem = routeList.querySelector(
            '[data-route-id="' + selectedRouteId + '"]'
        );

        if (activeListItem) {
            activeListItem.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    });
    
    if (routeSearchInput && routeSearchClear) {
        routeSearchInput.addEventListener('input', function () {
            routeSearchTerm = routeSearchInput.value
                .trim()
                .toLocaleLowerCase('de-CH');

            routeSearchClear.hidden = routeSearchTerm === '';

            updateVisibleRouteList();
        });

        routeSearchClear.addEventListener('click', function () {
            routeSearchInput.value = '';
            routeSearchTerm = '';
            routeSearchClear.hidden = true;

            updateVisibleRouteList();
            routeSearchInput.focus();
        });
    }

        document.addEventListener('click', function (event) {
            var button = event.target.closest('[data-map-filter]');

            if (!button) {
                return;
            }

            if (!document.getElementById('map-selection').contains(button)) {
                return;
            }

            var filterName = button.getAttribute('data-map-filter');

            if (
                !Object.prototype.hasOwnProperty.call(
                    mapFilters,
                    filterName
                )
            ) {
                return;
            }

            mapFilters[filterName] = !mapFilters[filterName];

            button.classList.toggle(
                'is-active',
                mapFilters[filterName]
            );

            button.setAttribute(
                'aria-pressed',
                String(mapFilters[filterName])
            );

            applyMapFilters();
        });

    if (
        routeSearchFilters &&
        routeSearchFiltersToggle
    ) {
        routeSearchFiltersToggle.addEventListener(
            'click',
            function () {
                routeSearchFilters.hidden =
                    !routeSearchFilters.hidden;

                routeSearchFiltersToggle.setAttribute(
                    'aria-expanded',
                    String(!routeSearchFilters.hidden)
                );

                if (!routeSearchFilters.hidden) {
                    updateDistanceFilter();
                }
            }
        );
    }

    applyMapFilters();
})();