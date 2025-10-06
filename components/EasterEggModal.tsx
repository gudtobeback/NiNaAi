import React from 'react';

const EasterEggModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-[#0A0A0A] font-mono text-green-400 rounded-lg shadow-xl w-full max-w-2xl border-2 border-gray-700 animate-scale-in p-6" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg text-white">[SECRET CONSOLE]</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <pre className="text-sm whitespace-pre-wrap">
{`Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 12.2(55)SE1
Copyright (c) 1986-2021 by Cisco Systems, Inc. and The Llama Foundation.
Compiled Mon 26-Apr-21 12:27 by L. L. Al Paca

* Mar 1 00:00:07.27: %SPANTREE-5-EXTENDED_SYSID: Extended SysId enabled for type vlan

Switch> enable
Password: 
Switch# show ip interface brief
Interface                  IP-Address      OK? Method Status                Protocol
Vlan1                      unassigned      YES NVRAM  up                    up
FastEthernet0/1            unassigned      YES unset  up                    up
FastEthernet0/2            unassigned      YES unset  down                  down
...
FastEthernet0/24           unassigned      YES unset  down                  down

Switch# conf t
Enter configuration commands, one per line.  End with CNTL/Z.
Switch(config)# interface FastEthernet0/1
Switch(config-if)# switchport mode access
Switch(config-if)# switchport access vlan 42
Switch(config-if)# speed 1000
% Invalid input. Did you mean <span class="text-yellow-400">'speed ludicrous'</span>?
Switch(config-if)# exit
Switch(config)# exit
Switch# show llamas
              ,
             /|      __
            / |   ,-~ /
           Y :|  //  /
           | jj /( .^
           >-"~"-v"
          /       Y
         jo  o    |
        ( ~T~     j
         >._-' _./
        /   "~"  |
       Y     _,  |
      /| ;-"~ _  l
     / l/ ,-"~    \
     \//\/      .- \
      Y        /    Y    -sS
      l       I     !
      ]\      _,\ "
      /"\ L L" L L
`}
        </pre>
      </div>
    </div>
  );
};

export default EasterEggModal;
