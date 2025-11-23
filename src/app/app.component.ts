import { Component } from '@angular/core';
import { DiffConfig } from 'my-lib';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'diff-library';
  headers={
      isHeader: true,
  leftHeaderName:'LeftSidessdas',
    rightHeader:'RightSidessdsd'
  }
    diffConfig: DiffConfig = {
  oldText: `hostname R1-OLD

interface GigabitEthernet0/0
 description LAN Interface
 ip address 192.168.1.1 255.255.255.0
 no shutdown

interface GigabitEthernet0/1
 description WAN Interface
 ip address 10.10.10.1 255.255.255.252
 shutdown

router bgp 65001
 neighbor 10.10.10.2 remote-as 65002

line vty 0 4
 login local
 transport input ssh

! No OSPF configured
! No ACL applied
! No NTP configured
`,
  newText: `hostname R1-NEW

interface GigabitEthernet0/0
 description LAN Interface
 ip address 192.168.1.1 255.255.255.0
 no shutdown

interface GigabitEthernet0/1
 description WAN Interface (Updated)
 ip address 10.10.10.1 255.255.255.252
 no shutdown

interface Loopback0
 ip address 1.1.1.1 255.255.255.255

router ospf 100
 router-id 1.1.1.1
 network 192.168.1.0 0.0.0.255 area 0

router bgp 65001
 neighbor 10.10.10.2 remote-as 65002
 neighbor 10.10.10.2 password CISCO123

ip access-list extended INTERNET-IN
 permit tcp any any eq 80
 permit tcp any any eq 443
 deny ip any any log

ntp server 172.16.1.1

line vty 0 4
 login local
 transport input ssh
`,

  showLineNumbers: true,


};

}
