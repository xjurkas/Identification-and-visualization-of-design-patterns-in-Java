CALL {
MATCH (subjectClass:Class)
MATCH (subjectType:Type {fqn: subjectClass.fqn})

// 1. Subject má attach-style metódu s parametrom typu T
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

// 2. observerType musí byť v projekte (Class alebo Interface node)
MATCH (observerNode)
WHERE (observerNode:Class OR observerNode:Interface)
  AND observerNode.fqn = observerType.fqn

// 3. Striktný discriminant voči Composite:
//    Subject NESMIE byť tranzitívne podtyp Observer
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

