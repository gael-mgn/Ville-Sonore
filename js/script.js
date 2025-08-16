function stringToArray(inputString) {
  // Supprimer les espaces superflus avant et après la chaîne
  const cleanedString = inputString.trim();
  
  // Diviser la chaîne en un tableau en utilisant le point-virgule comme séparateur
  const array = cleanedString.split(';');
  
  // Nettoyer chaque valeur du tableau pour enlever les espaces autour
  const result = array.map(item => item.trim().replace("valeur ", ""));
  
  return result;
}