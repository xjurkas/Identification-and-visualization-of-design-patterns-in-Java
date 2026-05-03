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
// NOVÉ: Subject má metódu s prefixom notify/fire/changed/publish/broadcast/dispatch
  AND EXISTS {
    MATCH (subjectType)-[:DECLARES]->(notifyMethod:Method)
    WHERE toLower(notifyMethod.name) STARTS WITH "notify"
       OR toLower(notifyMethod.name) STARTS WITH "fire"
       OR toLower(notifyMethod.name) STARTS WITH "changed"
       OR toLower(notifyMethod.name) STARTS WITH "publish"
       OR toLower(notifyMethod.name) STARTS WITH "broadcast"
       OR toLower(notifyMethod.name) STARTS WITH "dispatch"
       OR toLower(notifyMethod.name) STARTS WITH "haschanged"
       OR toLower(notifyMethod.name) STARTS WITH "setchanged"
  }

SET subjectType:Subject
SET observerType:Observer
}
