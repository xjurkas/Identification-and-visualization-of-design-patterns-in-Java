CALL {
MATCH (subjectClass:Class)
MATCH (subjectType:Type {fqn: subjectClass.fqn})

MATCH (subjectType)-[:DECLARES]->(attachMethod:Method)
MATCH (attachMethod)-[:HAS_PARAMETER]->(param:Parameter)
MATCH (param)-[:PARAMETER_TYPE]->(observerType:Type)
WHERE (toLower(attachMethod.name) STARTS WITH "add"
   OR toLower(attachMethod.name) STARTS WITH "attach"
   OR toLower(attachMethod.name) STARTS WITH "register"
   OR toLower(attachMethod.name) STARTS WITH "subscribe"
   OR toLower(attachMethod.name) STARTS WITH "addlistener"
   OR toLower(attachMethod.name) STARTS WITH "addobserver")
  AND subjectType <> observerType

// NOVÉ: Observer musí byť Interface alebo abstract Class
MATCH (observerNode)
WHERE observerNode.fqn = observerType.fqn
  AND (observerNode:Interface
       OR (observerNode:Class AND (
             observerNode.isAbstract = true
             OR EXISTS { MATCH (observerNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
          )))

// Striktný discriminant voči Composite
WITH subjectClass, subjectType, observerNode, observerType
WHERE NOT EXISTS {
    MATCH (subjectClass)-[:EXTENDS|IMPLEMENTS*1..3]->(observerNode)
}

WITH DISTINCT subjectType, observerType
SET subjectType:Subject
SET observerType:Observer
RETURN DISTINCT subjectType, observerType
}

RETURN DISTINCT
  subjectType.fqn AS subjectFqn,
  observerType.fqn AS observerFqn
ORDER BY subjectFqn, observerFqn;

