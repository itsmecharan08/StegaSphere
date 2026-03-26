"use client"
import React, { useEffect, useState } from 'react'
import { Web3ReactProvider, useWeb3React } from '@web3-react/core'
import { Web3 } from 'web3'
import { injected } from '../wallet/Connectors'

function getLibrary(provider) {
  return new Web3(provider)
}

function EagerConnect({ children }) {
  const { activate, active } = useWeb3React()
  const [tried, setTried] = useState(false)

  useEffect(() => {
    injected.isAuthorized().then((isAuthorized) => {
      if (isAuthorized) {
        activate(injected, undefined, true).catch(() => {
          setTried(true)
        })
      } else {
        setTried(true)
      }
    })
  }, [activate])

  useEffect(() => {
    if (!tried && active) {
      setTried(true)
    }
  }, [tried, active])

  return children
}

export default function Web3Provider({ children }) {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <EagerConnect>
        {children}
      </EagerConnect>
    </Web3ReactProvider>
  )
}
