/*global WildRydes _config*/

var WildRydes = window.WildRydes || {};
WildRydes.map = WildRydes.map || {};
let map;

(function rideScopeWrapper($) {
    var authToken;
    WildRydes.authToken.then(function setAuthToken(token) {
        if (token) {
            authToken = token;
        } else {
            window.location.href = '/signin.html';
        }
    }).catch(function handleTokenError(error) {
        alert(error);
        window.location.href = '/signin.html';
    });

    //  requestUnicorn
    //      make the POST request to the server
    function requestUnicorn(pickupLocation) {
        $.ajax({
            method: 'POST',
            url: _config.api.invokeUrl + '/ride',
            headers: {
                Authorization: authToken
            },
            data: JSON.stringify({
                PickupLocation: {
                    Latitude: pickupLocation.latitude,
                    Longitude: pickupLocation.longitude
                }
            }),
            contentType: 'application/json',
            success: result => completeRequest(result, pickupLocation),
            error: function ajaxError(jqXHR, textStatus, errorThrown) {
                console.error('Error requesting ride: ', textStatus, ', Details: ', errorThrown);
                console.error('Response: ', jqXHR.responseText);
                alert('An error occurred when requesting your unicorn:\n' + jqXHR.responseText);
            }
        });
    }

    //  completeRequest
    //      a Unicorn has been dispatched to your location
    function completeRequest(result, pickupLocation) {
        var unicorn;
        var pronoun;

        console.log('Response received from API: ', result);
        unicorn = result.Unicorn;
        pronoun = unicorn.Gender === 'Male' ? 'his' : 'her';
        displayUpdate(unicorn.Name + ', your ' + unicorn.Color + ' unicorn, is on ' + pronoun + ' way.', unicorn.Color);

        console.log(pickupLocation);
        //  get the local weather, find nearby restaurants, movies
        // getWeather(pickupLocation, unicorn)

        animateArrival(function animateCallback() {
            displayUpdate(unicorn.Name + ' has arrived. Giddy up!', unicorn.Color);
            WildRydes.map.unsetLocation();

            $('#request').prop('disabled', 'disabled');
            $('#request').text('Set Pickup');
        });
    }

    // Register click handler for #request button
    $(function onDocReady() {
        $('#request').click(handleRequestClick);
        $('#cityInfoButton').click(function(event) {
            cityInfo(event);
        });

        WildRydes.authToken.then(function updateAuthMessage(token) {
            if (token) {
                displayUpdate('You are authenticated. Click to see your <a href="#authTokenModal" data-toggle="modal">auth token</a>.');
                $('.authToken').text(token);
            }
        });

        if (!_config.api.invokeUrl) {
            $('#noApiMessage').show();
        }

        window.navigator.geolocation
            .getCurrentPosition(setLocation);

        //  put the map behind the updates list
        document.getElementById("map").style.zIndex = "10";

        function setLocation(loc) {
            map = L.map('map').setView([loc.coords.latitude, loc.coords.longitude], 13);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(map);

            WildRydes.map.center = {latitude: loc.coords.latitude, longitude: loc.coords.longitude};
            let b = map.getBounds();        //  TODO moved
            WildRydes.map.extent = {minLat: b._northEast.lat, minLng: b._northEast.lng,
                maxLat: b._southWest.lat, maxLng: b._southWest.lng};

            WildRydes.marker  = L.marker([loc.coords.latitude, loc.coords.longitude]).addTo(map);
            var myIcon = L.icon({
                iconUrl: 'images/unicorn-icon.png',
                iconSize: [25, 25],
                iconAnchor: [22, 24],
                shadowSize: [25, 25],
                shadowAnchor: [22, 24]
            });
            WildRydes.unicorn = L.marker([loc.coords.latitude, loc.coords.longitude], {icon: myIcon}).addTo(map);
            // WildRydes.marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();

            // var popup = L.popup();
            map.on('click', onMapClick);

            function onMapClick(e) {            //  TODO move to esri.js
                WildRydes.map.selectedPoint = {longitude: e.latlng.lng, latitude: e.latlng.lat};
                if (WildRydes.marker)       WildRydes.marker.remove();
                handlePickupChanged();

                WildRydes.marker  = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);

                // popup
                //     .setLatLng(e.latlng)
                //     .setContent("You clicked the map at " + e.latlng.toString())
                //     .openOn(map);
            }
        }
    });

    //  handlePickupChanged
    //      enable the Pickup button and set text to Request Unicorn
    function handlePickupChanged() {
        var requestButton = $('#request');
        requestButton.text('Request Unicorn');
        requestButton.prop('disabled', false);
    }

    //  handleRequestClick
    //      get current request location and POST request to server
    function handleRequestClick(event) {
        var pickupLocation =  WildRydes.map.selectedPoint;

        event.preventDefault();
        requestUnicorn(pickupLocation);
    }

    //  animateArrival
    //      animate the Unicorn's arrival to the user's pickup location
    function animateArrival(callback) {
        var dest = WildRydes.map.selectedPoint;
        var origin = {};

        if (dest.latitude > WildRydes.map.center.latitude) {
            origin.latitude = WildRydes.map.extent.minLat;
        } else {
            origin.latitude = WildRydes.map.extent.maxLat;
        }

        if (dest.longitude > WildRydes.map.center.longitude) {
            origin.longitude = WildRydes.map.extent.minLng;
        } else {
            origin.longitude = WildRydes.map.extent.maxLng;
        }

        WildRydes.map.animate(origin, dest, callback);
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(lat2-lat1);  // deg2rad below
        var dLon = deg2rad(lon2-lon1); 
        var a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2)
        ; 
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        var distance = R * c; // Distance in km
        return distance;
    }
    
    function deg2rad(deg) {
        return deg * (Math.PI/180)
    }

    function cityInfo(event){

        const countries = [
            { name: "Switzerland", cost: 4.45 },
            { name: "Kuwait", cost: 3.24 },
            { name: "Luxembourg", cost: 3.23 },
            { name: "Jamaica", cost: 3.22 },
            { name: "Albania", cost: 3.18 },
            { name: "Venezuela", cost: 2.85 },
            { name: "Japan", cost: 2.77 },
            { name: "Netherlands", cost: 2.59 },
            { name: "Mauritius", cost: 2.46 },
            { name: "Belgium", cost: 2.26 },
            { name: "Qatar", cost: 2.20 },
            { name: "Denmark", cost: 2.17 },
            { name: "Malta", cost: 2.16 },
            { name: "Germany", cost: 2.16 },
            { name: "New Zealand", cost: 2.09 },
            { name: "Iraq", cost: 2.00 },
            { name: "France", cost: 1.96 },
            { name: "Austria", cost: 1.94 },
            { name: "United States", cost: 1.86 },
            { name: "Australia", cost: 1.85 },
            { name: "Sweden", cost: 1.82 },
            { name: "Panama", cost: 1.75 },
            { name: "Chile", cost: 1.72 },
            { name: "Uruguay", cost: 1.66 },
            { name: "Ireland", cost: 1.62 },
            { name: "Finland", cost: 1.62 },
            { name: "Costa Rica", cost: 1.61 },
            { name: "Saudi Arabia", cost: 1.57 },
            { name: "United Kingdom", cost: 1.56 },
            { name: "Italy", cost: 1.55 },
            { name: "Colombia", cost: 1.55 },
            { name: "Ecuador", cost: 1.50 },
            { name: "Canada", cost: 1.50 },
            { name: "Peru", cost: 1.47 },
            { name: "Bolivia", cost: 1.45 },
            { name: "Mexico", cost: 1.43 },
            { name: "Cyprus", cost: 1.40 },
            { name: "Norway", cost: 1.38 },
            { name: "Palestine", cost: 1.35 },
            { name: "Czech Republic", cost: 1.33 },
            { name: "Hong Kong (China)", cost: 1.28 },
            { name: "Hungary", cost: 1.24 },
            { name: "Spain", cost: 1.19 },
            { name: "Slovenia", cost: 1.17 },
            { name: "Thailand", cost: 1.13 },
            { name: "Jordan", cost: 1.13 },
            { name: "Israel", cost: 1.08 },
            { name: "Slovakia", cost: 1.08 },
            { name: "Montenegro", cost: 1.08 },
            { name: "Greece", cost: 1.08 },
            { name: "Libya", cost: 1.03 },
            { name: "Brazil", cost: 1.02 },
            { name: "Kenya", cost: 0.98 },
            { name: "Croatia", cost: 0.97 },
            { name: "Puerto Rico", cost: 0.97 },
            { name: "Argentina", cost: 0.90 },
            { name: "Serbia", cost: 0.88 },
            { name: "Portugal", cost: 0.86 },
            { name: "Latvia", cost: 0.86 },
            { name: "Estonia", cost: 0.86 },
            { name: "Singapore", cost: 0.86 },
            { name: "Bosnia And Herzegovina", cost: 0.83 },
            { name: "United Arab Emirates", cost: 0.82 },
            { name: "Kosovo", cost: 0.81 },
            { name: "South Africa", cost: 0.80 },
            { name: "Taiwan", cost: 0.80 },
            { name: "Oman", cost: 0.78 },
            { name: "Lithuania", cost: 0.75 },
            { name: "Nepal", cost: 0.75 },
            { name: "Georgia", cost: 0.75 },
            { name: "Poland", cost: 0.75 },
            { name: "Morocco", cost: 0.74 },
            { name: "Bulgaria", cost: 0.66 },
            { name: "Romania", cost: 0.65 },
            { name: "Malaysia", cost: 0.64 },
            { name: "Vietnam", cost: 0.62 },
            { name: "North Macedonia", cost: 0.61 },
            { name: "South Korea", cost: 0.61 },
            { name: "Azerbaijan", cost: 0.59 },
            { name: "Kazakhstan", cost: 0.54 },
            { name: "Turkey", cost: 0.52 },
            { name: "Bangladesh", cost: 0.45 },
            { name: "Algeria", cost: 0.37 },
            { name: "Pakistan", cost: 0.35 },
            { name: "China", cost: 0.35 },
            { name: "Ukraine", cost: 0.33 },
            { name: "Russia", cost: 0.33 },
            { name: "Egypt", cost: 0.32 },
            { name: "Indonesia", cost: 0.32 },
            { name: "Tunisia", cost: 0.32 },
            { name: "Sri Lanka", cost: 0.31 },
            { name: "Belarus", cost: 0.30 },
            { name: "Iran", cost: 0.30 },
            { name: "India", cost: 0.30 },
            { name: "Uzbekistan", cost: 0.29 },
            { name: "Armenia", cost: 0.27 },
            { name: "Philippines", cost: 0.27 }
        ];
        var countryCosts = {};

        for (var i = 0; i < countries.length; i++) {
            countryCosts[countries[i].name] = countries[i].cost;
        }

        var pickupLocation = WildRydes.map.selectedPoint || WildRydes.map.center;
        console.log(pickupLocation);
    
        // Use OpenCage Geocoding API to get city name from coordinates
        $.ajax({
            url: `https://api.opencagedata.com/geocode/v1/json?q=${pickupLocation.latitude}+${pickupLocation.longitude}&key=dd507c051aae45ef90f32bc004e7c475`,
            method: 'GET',
            success: function(data) {
                var country = data.results[0].components.country;
                console.log('Country:', country);
                console.log('results' , data.results[0]);

                fare = countryCosts[country];
                console.log('fare', fare);
            }
        });
    };


}(jQuery));

//  these functions below here are my utility functions
//      to present messages to users
//      and to particularly add some 'sizzle' to the application

//  displayUpdate
//      nice utility method to show message to user
function displayUpdate(text, color='green') {
    $('#updates').prepend($(`<li style="background-color:${color}">${text}</li>`));
}

