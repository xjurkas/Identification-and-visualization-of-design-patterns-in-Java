CALL {
// 1. Component = Interface ALEBO abstraktná trieda (s IN_FILE)
MATCH (component)
WHERE ( component:Interface
        OR (component:Class AND component.isAbstract = true) )
  AND EXISTS { MATCH (component)-[:IN_FILE]->() }

// 2. Nájdi všetky triedy konformujúce s component:
//    - IMPLEMENTS (pre interface)
//    - EXTENDS (pre abstract class)
//    - reťazené EXTENDS -> IMPLEMENTS (pre interface cez hierarchiu)
//    - reťazené EXTENDS -> EXTENDS (pre abstract class cez hierarchiu)
OPTIONAL MATCH (conformerImpl:Class)-[:IMPLEMENTS]->(component)
OPTIONAL MATCH (conformerExt:Class)-[:EXTENDS]->(component)
  WHERE component:Class
OPTIONAL MATCH (indirectImpl:Class)-[:EXTENDS*1..5]->(midClass:Class)
              -[:IMPLEMENTS]->(component)
OPTIONAL MATCH (indirectExt:Class)-[:EXTENDS*1..5]->(component)
  WHERE component:Class
WITH component,
     collect(DISTINCT conformerImpl) + collect(DISTINCT conformerExt)
     + collect(DISTINCT indirectImpl) + collect(DISTINCT indirectExt) AS allConformers

// 3. Base decorator: musí mať field typu component
UNWIND allConformers AS baseDecoratorClass
WITH component, baseDecoratorClass
WHERE baseDecoratorClass IS NOT NULL
MATCH (baseDecoratorType:Type {fqn: baseDecoratorClass.fqn})
      -[:HAS_FIELD]->(componentField:Field)
      -[:FIELD_TYPE]->(componentType:Type)
WHERE componentType.fqn = component.fqn

// 4. Constructor injection — parameter typu component
WITH component, baseDecoratorClass, baseDecoratorType
WHERE EXISTS {
  MATCH (baseDecoratorType)-[:DECLARES]->(ctor)
  WHERE ctor:Constructor
     OR (ctor:Method AND ctor.name STARTS WITH baseDecoratorClass.name + "(")
  MATCH (ctor)-[:HAS_PARAMETER]->(param)-[:PARAMETER_TYPE]->(paramType:Type)
  WHERE paramType.fqn = component.fqn
}

// 5. Spočítaj metódy na component (interface aj abstract class deklarujú metódy cez DECLARES)
WITH component, baseDecoratorClass, baseDecoratorType
OPTIONAL MATCH (:Type {fqn: component.fqn})-[:DECLARES]->(componentMethod:Method)
WITH component, baseDecoratorClass, baseDecoratorType,
     count(DISTINCT componentMethod) AS componentMethodCount
WHERE componentMethodCount > 0

// 6. Spočítaj delegujúce metódy (CALLS na metódy component-u)
MATCH (baseDecoratorType)-[:DECLARES]->(decoratorMethod:Method)
      -[:CALLS]->(calledMethod:Method)
WHERE calledMethod.containerFqn = component.fqn
  AND coalesce(calledMethod.isSynthetic, false) = false
WITH component, baseDecoratorClass,
     count(DISTINCT decoratorMethod) AS delegatingMethods,
     componentMethodCount

// 7. Proporcionálny prah — deleguj >= 50% metód component, minimum 2
WHERE delegatingMethods >= 2
  AND (toFloat(delegatingMethods) / toFloat(componentMethodCount)) >= 0.5

// 8. Musí existovať aspoň jeden concrete decorator (podtrieda)
MATCH (concreteDecoratorClass:Class)-[:EXTENDS]->(baseDecoratorClass)

// 9. Musí existovať aspoň jeden concrete component (nie je dekorátor)
//    Pre Interface: IMPLEMENTS, pre abstract Class: EXTENDS
WHERE EXISTS {
  MATCH (cc:Class)-[:IMPLEMENTS|EXTENDS]->(component)
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

