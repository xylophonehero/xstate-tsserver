export const machineWithSetupQuery = `
(call_expression
  function: (member_expression
    object: (call_expression
      function: (identifier) @xstate.setup (#eq? @xstate.setup "setup")
      arguments: (arguments) @xstate.setup.config)
    property: (property_identifier) @xstate.createMachine (#eq? @xstate.createMachine "createMachine"))
  arguments: (arguments
    (object) @xstate.state.config @xstate.root.config)) @xstate.machine
`;

export const setupActionsQuery = `
(pair
  key: (property_identifier) @key (#eq? @key "actions")
  value: (object [
    (pair
      key: (property_identifier) @action.name
      value: (_)
    )
    (shorthand_property_identifier) @action.name
  ])
)
`;

export const configActionsQuery = `
(pair
  key: (property_identifier) @key
    (#match? @key "actions|entry|exit")
  value: [
    (array (string (string_fragment)) @xstate.action)
    (string (string_fragment)) @xstate.action
    (array
      (object
        (pair
          key: (property_identifier) @type_key
            (#eq? @type_key "type")
          value: (string (string_fragment)) @xstate.action
        )
      )
    )
    (object
      (pair
        key: (property_identifier) @type_key
          (#eq? @type_key "type")
        value: (string (string_fragment)) @xstate.action
      )
    )
  ]
)

(call_expression
  function: (identifier) @enqueue (#eq? @enqueue "enqueue")
  arguments: (arguments [ 
    (string (string_fragment)) @xstate.action
    (object
      (pair
        key: (property_identifier) @type_key
          (#eq? @type_key "type")
        value: (string (string_fragment)) @xstate.action
      )
    )
  ])
)
`;

export const setupGuardsQuery = `
(pair
  key: (property_identifier) @key (#eq? @key "guards")
  value: (object [
    (pair
      key: (property_identifier) @guard.name
      value: (_)
    )
    (shorthand_property_identifier) @guard.name
  ])
)
`;

export const configGuardsQuery = `
(pair
  key: (property_identifier) @key
    (#eq? @key "guard")
  value: [
    (string (string_fragment)) @xstate.guard
    (object
      (pair
        key: (property_identifier) @type_key
          (#eq? @type_key "type")
        value: (string (string_fragment)) @xstate.guard
      )
    )
  ]
)

(call_expression
  function: (identifier) @check (#match? @check "check|not")
  arguments: (arguments [
    (string (string_fragment)) @xstate.guard
    (object
      (pair
        key: (property_identifier) @type_key
          (#eq? @type_key "type")
        value: (string (string_fragment)) @xstate.guard
      )
    )]
  )
)

(call_expression
  function: (identifier) @hog (#match? @hog "and|or")
  arguments: (arguments 
    (array [
      (string (string_fragment)) @xstate.guard
      (object
        (pair
          key: (property_identifier) @type_key
            (#eq? @type_key "type")
          value: (string (string_fragment)) @xstate.guard
        )
      )]
    )
  )
)
`;

export const setupActorsQuery = `
(pair
  key: (property_identifier) @key (#eq? @key "actors")
  value: (object [
    (pair
      key: (property_identifier) @actor.name
      value: (_)
    )
    (shorthand_property_identifier) @actor.name
  ])
)
`;

export const configActorsQuery = `
(pair
  key: (property_identifier) @invoke (#eq? @invoke "invoke")
  value: [
    (object
      (pair
        key: (property_identifier) @invoke.src (#eq? @invoke.src "src")
        value: (string (string_fragment)) @xstate.actor
      )
    )
    (array
      (object
        (pair
          key: (property_identifier) @invoke.src (#eq? @invoke.src "src")
          value: (string (string_fragment)) @xstate.actor
        )
      )
    )
  ]
)
`

export const setupDelaysQuery = `
(pair
  key: (property_identifier) @key (#eq? @key "delays")
  value: (object [
    (pair
      key: (property_identifier) @delay.name
      value: (_)
    )
    (shorthand_property_identifier) @delay.name
  ])
)
`;


export const configDelaysQuery = `
(pair
  key: (property_identifier) @key (#eq? @key "after")
  value: (object
    (pair
      key: (property_identifier) @xstate.delay
      value: (_)
    )
  )
)

(call_expression
	function: (identifier) @action (#match? @action "sendTo|raise")
  arguments: (arguments
		(object
			(pair
				key: (property_identifier) @event (#eq? @event "delay")
				value: (string) @xstate.delay
			)
		)
  )
)
`
