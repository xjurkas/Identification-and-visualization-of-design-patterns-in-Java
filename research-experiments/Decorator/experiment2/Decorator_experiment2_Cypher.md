CALL {
// 1. Nájdi lokálny interface (component)
MATCH (componentInterface:Interface)
WHERE EXISTS { MATCH (componentInterface)-[:IN_FILE]->() }

// 2. Nájdi všetky triedy implementujúce interface (priamo aj cez dedičnosť)
OPTIONAL MATCH (directImpl:Class)-[:IMPLEMENTS]->(componentInterface)
OPTIONAL MATCH (indirectImpl:Class)-[:EXTENDS*1..5]->(ancestor:Class)
              -[:IMPLEMENTS]->(componentInterface)
WITH componentInterface,
     collect(DISTINCT directImpl) + collect(DISTINCT indirectImpl) AS allConformers

// 3. Pre každého kandidáta na base decorator: musí mať field typu component interface
UNWIND allConformers AS baseDecoratorClass
WITH componentInterface, baseDecoratorClass
WHERE baseDecoratorClass IS NOT NULL
MATCH (baseDecoratorType:Type {fqn: baseDecoratorClass.fqn})
      -[:HAS_FIELD]->(componentField:Field)
      -[:FIELD_TYPE]->(componentType:Type)
WHERE componentType.fqn = componentInterface.fqn

// 4. NOVÉ: Constructor injection — base decorator musí mať konštruktor
//    s parametrom typu component interface
WITH componentInterface, baseDecoratorClass, baseDecoratorType
WHERE EXISTS {
  MATCH (baseDecoratorType)-[:DECLARES]->(ctor)
  WHERE ctor:Constructor
     OR (ctor:Method AND ctor.name STARTS WITH baseDecoratorClass.name + "(")
  MATCH (ctor)-[:HAS_PARAMETER]->(param)-[:PARAMETER_TYPE]->(paramType:Type)
  WHERE paramType.fqn = componentInterface.fqn
}

// 5. Spočítaj metódy na component interface
WITH componentInterface, baseDecoratorClass, baseDecoratorType
OPTIONAL MATCH (:Type {fqn: componentInterface.fqn})-[:DECLARES]->(ifaceMethod:Method)
WITH componentInterface, baseDecoratorClass, baseDecoratorType,
     count(DISTINCT ifaceMethod) AS interfaceMethodCount
WHERE interfaceMethodCount > 0

// 6. Spočítaj delegujúce metódy
MATCH (baseDecoratorType)-[:DECLARES]->(decoratorMethod:Method)
      -[:CALLS]->(calledMethod:Method)
WHERE calledMethod.containerFqn = componentInterface.fqn
  AND coalesce(calledMethod.isSynthetic, false) = false
WITH componentInterface, baseDecoratorClass,
     count(DISTINCT decoratorMethod) AS delegatingMethods,
     interfaceMethodCount

// 7. Proporcionálny prah
WHERE delegatingMethods >= 2
  AND (toFloat(delegatingMethods) / toFloat(interfaceMethodCount)) >= 0.5

// 8. Musí existovať aspoň jeden concrete decorator (podtrieda)
MATCH (concreteDecoratorClass:Class)-[:EXTENDS]->(baseDecoratorClass)

// 9. Musí existovať aspoň jeden concrete component (nie je dekorátor)
WHERE EXISTS {
  MATCH (cc:Class)-[:IMPLEMENTS]->(componentInterface)
  WHERE cc.fqn <> baseDecoratorClass.fqn
    AND NOT EXISTS { MATCH (cc)-[:EXTENDS*]->(baseDecoratorClass) }
}

WITH DISTINCT baseDecoratorClass
SET baseDecoratorClass:Decorator

RETURN DISTINCT baseDecoratorClass
}

RETURN DISTINCT
  baseDecoratorClass.fqn AS decoratorFqn
ORDER BY decoratorFqn;
