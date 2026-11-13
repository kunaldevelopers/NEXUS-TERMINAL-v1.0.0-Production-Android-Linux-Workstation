package com.nexusterminal.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.nexusterminal.app.plugins.NexusDistroPlugin
import com.nexusterminal.app.plugins.NexusFilePlugin
import com.nexusterminal.app.plugins.NexusPackagePlugin
import com.nexusterminal.app.plugins.NexusSshPlugin
import com.nexusterminal.app.plugins.NexusSystemPlugin
import com.nexusterminal.app.plugins.NexusTerminalPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(NexusTerminalPlugin::class.java)
        registerPlugin(NexusDistroPlugin::class.java)
        registerPlugin(NexusPackagePlugin::class.java)
        registerPlugin(NexusSshPlugin::class.java)
        registerPlugin(NexusFilePlugin::class.java)
        registerPlugin(NexusSystemPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}

