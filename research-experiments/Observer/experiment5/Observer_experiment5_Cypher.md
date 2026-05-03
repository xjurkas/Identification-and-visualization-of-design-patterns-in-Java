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

MATCH (observerNode)
WHERE observerNode.fqn = observerType.fqn
  AND (observerNode:Interface
       OR (observerNode:Class AND (
             observerNode.isAbstract = true
             OR EXISTS { MATCH (observerNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
          )))

WITH subjectClass, subjectType, observerNode, observerType
WHERE NOT EXISTS {
    MATCH (subjectClass)-[:EXTENDS|IMPLEMENTS*1..3]->(observerNode)
}

WITH DISTINCT subjectType, observerType
WHERE EXISTS {
    MATCH (subjectType)-[:HAS_FIELD]->(f:Field)-[:FIELD_TYPE]->(ft:Type)
    WHERE ft = observerType
       OR ft.name IN ["Vector","List","ArrayList","LinkedList","Collection","Set","HashSet","TreeSet","Hashtable","HashMap","Map"]
       OR ft.fqn ENDS WITH ".Vector"
       OR ft.fqn ENDS WITH ".List"
       OR ft.fqn ENDS WITH ".ArrayList"
       OR ft.fqn ENDS WITH ".LinkedList"
       OR ft.fqn ENDS WITH ".Collection"
       OR ft.fqn ENDS WITH ".Set"
       OR ft.fqn ENDS WITH ".HashSet"
       OR ft.fqn ENDS WITH ".Hashtable"
}
// NOVÉ: Aspoň jeden z behaviorálnych signálov A/B/C
  AND (
    // A: Subject má notify-prefix metódu
    EXISTS {
      MATCH (subjectType)-[:DECLARES]->(nm:Method)
      WHERE toLower(nm.name) STARTS WITH "notify"
         OR toLower(nm.name) STARTS WITH "fire"
         OR toLower(nm.name) STARTS WITH "changed"
         OR toLower(nm.name) STARTS WITH "publish"
         OR toLower(nm.name) STARTS WITH "broadcast"
         OR toLower(nm.name) STARTS WITH "dispatch"
         OR toLower(nm.name) STARTS WITH "haschanged"
         OR toLower(nm.name) STARTS WITH "setchanged"
    }
    OR
    // B: Subject metóda CALLS metódu deklarovanú na Observer
    EXISTS {
      MATCH (subjectType)-[:DECLARES]->(sm:Method)-[:CALLS]->(target:Method)
      MATCH (observerType)-[:DECLARES]->(target)
    }
    OR
    // C: Observer má metódu s update-podobným prefixom
    EXISTS {
      MATCH (observerType)-[:DECLARES]->(um:Method)
      WHERE toLower(um.name) STARTS WITH "update"
         OR toLower(um.name) STARTS WITH "notify"
         OR toLower(um.name) STARTS WITH "handle"
         OR toLower(um.name) STARTS WITH "changed"
         OR toLower(um.name) STARTS WITH "receive"
         OR toLower(um.name) STARTS WITH "fire"
         OR toLower(um.name) STARTS WITH "on"
    }
  )

SET subjectType:Subject
SET observerType:Observer
}
