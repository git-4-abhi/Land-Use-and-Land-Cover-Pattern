 var image = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
   .filterDate('1990-12-13', '1995-12-31')
  .filter(ee.Filter.lte('CLOUD_COVER', 5))
  .filterBounds(A)
  .median().select(['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B7']).multiply(0.0000275).add(-0.2)
  .clip(A);
 
Map.addLayer(image)
Map.setCenter(76.2025, 10.5126, 10)

var ndvi = image.normalizedDifference(['SR_B4', 'SR_B3']).rename('NDVI');
var ndbi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDBI');
var mndwi = image.normalizedDifference(['SR_B2', 'SR_B5']).rename('MNDWI');
var bsi = image.expression(
    '((SWIR + RED) - (NIR + BLUE)) / ((SWIR + RED) + (NIR + BLUE))', {
      'SWIR': image.select('SR_B5'),
      'RED': image.select('SR_B3'),
      'NIR': image.select('SR_B4'),
      'BLUE': image.select('SR_B1')
    }).rename('BSI');
   
var img = image.addBands([ndvi,ndbi,mndwi,bsi])
   
print(img)
Map.addLayer(img,{},'new')


var UrbanLabeled = Urban.map(function(f) { return f.set('Class', 1); });
var RiceLabeled = Rice.map(function(f) { return f.set('Class', 3); });
var WaterLabeled = Water.map(function(f) { return f.set('Class', 2); });
var OtherVegLabeled = Othervegetation.map(function(f) { return f.set('Class', 4); });

var trainingSamples = UrbanLabeled.merge(RiceLabeled).merge(WaterLabeled).merge(OtherVegLabeled);

function classifyImageWithAccuracy(image, bands, label) {
  var samples = image.select(bands).sampleRegions({
  collection: trainingSamples,
  properties: ['Class'],
  scale: 30
}).randomColumn('random');

  var training = samples.filter(ee.Filter.lt('random', 0.8));
  var testing = samples.filter(ee.Filter.gte('random', 0.8));

  var classifier = ee.Classifier.smileRandomForest(100).train({
    features: training,
    classProperty: 'Class',
    inputProperties: bands
  });

  var classified = image.classify(classifier);
  var validated = testing.classify(classifier);
  var confusionMatrix = validated.errorMatrix('Class', 'classification');

  print('--- Accuracy for ' + label + ' ---');
  print('Confusion Matrix:', confusionMatrix);
  print('Overall Accuracy:', confusionMatrix.accuracy());
  print('Kappa Coefficient:', confusionMatrix.kappa());
  print('User Accuracy:', confusionMatrix.consumersAccuracy());
  print('Producer Accuracy:', confusionMatrix.producersAccuracy());

  return classified;
}


var bands = ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7', 'NDVI', 'NDBI', 'MNDWI', 'BSI'];

var classL1 = classifyImageWithAccuracy(img, bands, '1995');

Map.addLayer(classL1,{},'classified_image')

Export.image.toDrive({
  image: classL1,
  scale:30,
  region: A,
  folder: 'GEE',
  fileNamePrefix: '1995',
  description: '95_downld'
})
