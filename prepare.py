import json,zipfile
from shapely.geometry import shape,mapping,box,Polygon
from shapely.ops import unary_union
root='/workspace/sites/europe-mandate/'
j=json.load(open(root+'countries-source.geojson'))
codes='AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH TR UA GB VA GE AM AZ'.split()
features=[]
for f in j['features']:
 p=f['properties']; code='XK' if p['name']=='Kosovo' else p['ISO3166-1-Alpha-2']
 if code not in codes:continue
 g=shape(f['geometry']).intersection(box(-26,33,64,72)).simplify(.018,preserve_topology=True)
 if g.is_empty:continue
 features.append({'type':'Feature','properties':{'code':code,'name':p['name']},'geometry':mapping(g)})
cy=next(f for f in features if f['properties']['code']=='CY')
cy['geometry']=mapping(unary_union([shape(cy['geometry'])]+[shape(f['geometry']) for f in j['features'] if f['properties']['name'] in ['Northern Cyprus','Cyprus No Mans Area']]).simplify(.018,preserve_topology=True))
# Natural Earth de facto geometry is corrected for the legal-border scenarios.
uk=next(f for f in features if f['properties']['code']=='UA');ru=next(f for f in features if f['properties']['code']=='RU')
crimea=shape(ru['geometry']).intersection(Polygon([(32.4,46.1),(33.5,46.25),(34.5,46.2),(35.5,46.3),(36.8,45.8),(36.7,44.2),(32.2,44.1)]))
uk['geometry']=mapping(shape(uk['geometry']).union(crimea));ru['geometry']=mapping(shape(ru['geometry']).difference(crimea))
json.dump({'type':'FeatureCollection','features':features},open(root+'dist/countries.json','w'),separators=(',',':'))
places=[]
with zipfile.ZipFile(root+'cities.zip') as z:
 for line in z.read('cities500.txt').decode().splitlines():
  a=line.split('\t');lat=float(a[4]);lon=float(a[5]);pop=int(a[14])
  if a[8] in codes and -26<lon<64 and 33<lat<72:
   places.append([a[1],round(lon,4),round(lat,4),pop,a[8],a[7]=='PPLC'])
places.sort(key=lambda x:(not x[5],-x[3]))
json.dump(places,open(root+'dist/places.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(features),'countries;',len(places),'settlements')
