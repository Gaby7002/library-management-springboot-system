package nexus.controller;

import nexus.model.Member;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/members")
@CrossOrigin("*")
public class MemberController {

    @GetMapping
    public List<Member> getMembers() {

        List<Member> members = new ArrayList<>();

        members.add(new Member(1L, "John Doe", "john@example.com"));
        members.add(new Member(2L, "Mary Jane", "mary@example.com"));

        return members;
    }
}