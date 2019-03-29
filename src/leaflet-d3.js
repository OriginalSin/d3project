!(function(){
    "use strict";

    let nsMvs = {
		data: [],
		filters: {},
		filtersOption: {},
		restUrl: '',
		svgFeatures: null,
		mapCont: null,
		leftPanel: null,
		map: null,
		createMap: (conf) => {
			conf = conf || {};
			nsMvs.query = nsMvs.addQuery(conf.graph || `query getAllLines { 
			  allVLineGeos{
				edges{
				  node{
					sid
					name
					lanesCount        
					lon
					lat
					geoJson
					complexName
					cafapStatus
					workingStatus
					mintransStatus
					mintransActStatus
				  }
				}
			  }
			}`).getAllLines;

			nsMvs.restUrl = conf.restUrl || '//graphql.dev.mvs.group/graphql';
			nsMvs.leftPanel = document.querySelector('.leftPanel');
			nsMvs.mapCont = document.querySelector('.mapCont');
			let map = nsMvs.map = L.map(nsMvs.mapCont).setView([conf.lat || 55.758031, conf.lng || 37.611694], conf.zomm || 7),
				baseLayer = conf.baseLayer || {
					url: '//{s}.tile.osm.org/{z}/{x}/{y}.png',
					attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
				};
			L.tileLayer(baseLayer.url, { attribution: baseLayer.attribution }).addTo(map);
			L.svg({clickable:true}).addTo(map);	

			nsMvs._request(nsMvs.query).then(json => {
				nsMvs.data = nsMvs._getFeatures(json);
				nsMvs.drawFeatures(nsMvs.data.features);
				nsMvs._createFilters();
			});
			return map;
		},
		_filterChanged: function(node) {
			let name = node.name;
			if (node.value) {
				nsMvs.filters[name] = node.value;
			} else {
				delete nsMvs.filters[name];
			}
			nsMvs.svgFeatures.each(function (d) {
				let props = d.properties,
					invisible = '';
				for (var key in nsMvs.filters) {
					let str = String(props[key]),
						val = nsMvs.filters[key];
					if (str.indexOf(val) === -1) {
						invisible = 'invisible';
						break;
					}
				}

				d3.select(this).attr("class", invisible);
			});
		},
		_createFilters: function() {
			let out = '';
			Object.keys(nsMvs.filtersOption).forEach((key) => {
				let arr = nsMvs.filtersOption[key];
				if (arr.length < 500) {
					let opt = arr.map((it) => '<option value="' + it + '">');
					out += `
						<div class="${key}">
							<span class="title">${key}</span>
							<input name="${key}" onchange="L.nsMvs._filterChanged(this)" list="${key}" title="Выбор фильтра" />
							<datalist id="${key}">${opt}</datalist>
						</div>`;
				}
			});
			nsMvs.leftPanel.innerHTML = out;
		},
		_projectPoint: function(x, y) {
			let point = nsMvs.map.latLngToLayerPoint(new L.LatLng(y, x));
			this.stream.point(point.x, point.y);
		},
		popup: L.popup(),
		popupKeys: ['sid', 'name', 'mintransStatus', 'mintransActStatus', 'complexName', 'cafapStatus', 'lanesCount'],
		drawFeatures: (data) => {
			let svg = d3.select(nsMvs.mapCont).select("svg").attr("pointer-events", "auto"),
				path = d3.geoPath().projection(d3.geoTransform({point: nsMvs._projectPoint})),
				g = svg.select("g");

			let featureElement = nsMvs.svgFeatures = g.selectAll("path")
				.data(data)
				.enter()
				.append("path")
				.attr("stroke", "gray")
				.attr("fill", "green")
				.attr("fill-opacity", 0.6)
				.on("click", function(d){
					d3.select(this).attr("fill", "red");
					let coords = d.geometry.coordinates,
						props = d.properties,
						cont = nsMvs.popupKeys.map((key) => {
							return '<div><span class="key">' + key + '</span>: <span class="val">' + props[key] + '</span></div>';
						}).join('\n');

					setTimeout(function() {
						nsMvs.popup.setLatLng(L.latLng(coords[1], coords[0]))
						.setContent(cont)
						.openOn(nsMvs.map);
					}, 0);

				}),
				update = () => {
					featureElement.attr("d", path);
				};        

			nsMvs.map.on("moveend", update);
			update();
		},
		_getFeatures: (json) => {					// получение Features collection
			let filtersOpt = {},
				arr = json.data.allVLineGeos.edges.map((d) => {
					let geo = JSON.parse(d.node.geoJson);
					delete d.node.geoJson;
					Object.keys(d.node).forEach((key) => {
						if (key !== 'lat' && key !== 'lon') {
							filtersOpt[key] = filtersOpt[key] || {};
							filtersOpt[key][d.node[key]] = true;
						}
					});
					return {
						type: 'Feature',
						geometry: geo,
						properties: d.node
					};
				});
			Object.keys(filtersOpt).forEach((key) => {
				nsMvs.filtersOption[key] = Object.keys(filtersOpt[key]);
			});
			return L.geoJSON(arr).toGeoJSON();
		},
		addQuery: (queryToAdd, queries) => {		// парсинг GraphQL схемы
			let key = queryToAdd.trim().split(' ')[1],
				queryEntry = {};
			queryEntry[key] = queryToAdd;
			return Object.assign({}, queries || {}, queryEntry);
		},
		_request: (query) => {						// получение модельки
			return fetch(nsMvs.restUrl, {
				method: 'post',
				mode: 'cors',
				headers: {'Content-type': 'application/json'},
				body: JSON.stringify({query: query})
			})
			.then(res => res.json())
			.catch(err => console.warn(err));

		}
	};
    L.nsMvs = L.nsMvs || {};
    L.nsMvs = nsMvs;
}());